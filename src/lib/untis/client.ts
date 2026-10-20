import "server-only";

import type { UntisConfig } from "./config";
import { UNTIS_ERROR_CODES, UntisError, toUntisError } from "./errors";
import { totp } from "./totp";

interface RpcResponse<T> {
  jsonrpc: "2.0";
  id: string;
  result?: T;
  error?: { code: number; message: string };
}

interface Session {
  sessionId: string;
  personId?: number;
  personType?: number;
  createdAt: number;
  lastUsedAt: number;
}

/**
 * WebUntis sessions time out after ~10 minutes of inactivity (configurable per school).
 * We proactively re-login a bit earlier instead of waiting for the -8520 error.
 */
const SESSION_IDLE_MS = 8 * 60 * 1000;

let requestCounter = 0;

/**
 * Minimal WebUntis JSON-RPC client.
 *
 * - Logs in lazily on the first call and caches the session.
 * - Concurrent calls share a single in-flight login.
 * - Expired sessions (-8520) trigger exactly one re-login + retry.
 */
export class UntisClient {
  private session: Session | null = null;
  private loginPromise: Promise<Session> | null = null;

  constructor(private readonly config: UntisConfig) {}

  get baseUrl() {
    return `https://${this.config.server}/WebUntis`;
  }

  get sessionSince() {
    return this.session?.createdAt;
  }

  private rpcUrl(path = "jsonrpc.do", query: Record<string, string> = {}) {
    const params = new URLSearchParams({ school: this.config.school, ...query });
    return `${this.baseUrl}/${path}?${params}`;
  }

  private cookieHeader(sessionId: string) {
    const schoolCookie = `_${Buffer.from(this.config.school).toString("base64")}`;
    return `JSESSIONID=${sessionId}; schoolname="${schoolCookie}"`;
  }

  private async post<T>(
    url: string,
    method: string,
    params: unknown,
    sessionId?: string,
  ): Promise<{ data: RpcResponse<T>; response: Response }> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": `${this.config.clientName} (Next.js)`,
          ...(sessionId ? { Cookie: this.cookieHeader(sessionId) } : {}),
        },
        body: JSON.stringify({ id: `${++requestCounter}`, method, params, jsonrpc: "2.0" }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
        cache: "no-store",
      });
    } catch (error) {
      throw toUntisError(error);
    }

    if (!response.ok) {
      throw new UntisError(
        response.status === 404 ? "config" : "network",
        response.status === 404
          ? `WebUntis-Endpunkt nicht gefunden (HTTP 404). Stimmt UNTIS_SERVER (${this.config.server})?`
          : `WebUntis-Server antwortet mit HTTP ${response.status}.`,
      );
    }

    let data: RpcResponse<T>;
    try {
      data = (await response.json()) as RpcResponse<T>;
    } catch (error) {
      throw new UntisError(
        "network",
        "WebUntis hat keine gültige JSON-Antwort geliefert (Wartungsarbeiten oder falscher Server?).",
        undefined,
        { cause: error },
      );
    }
    return { data, response };
  }

  private async passwordLogin(): Promise<Session> {
    const { data } = await this.post<{
      sessionId: string;
      personId?: number;
      personType?: number;
    }>(this.rpcUrl(), "authenticate", {
      user: this.config.username,
      password: this.config.password,
      client: this.config.clientName,
    });

    if (data.error) throw UntisError.fromRpc(data.error.code, data.error.message);
    if (!data.result?.sessionId) {
      throw new UntisError("auth", "WebUntis hat keine Session-ID zurückgegeben.");
    }
    const now = Date.now();
    return {
      sessionId: data.result.sessionId,
      personId: data.result.personId,
      personType: data.result.personType,
      createdAt: now,
      lastUsedAt: now,
    };
  }

  /** Login with the app secret (one-time password), as used by the official mobile app. */
  private async secretLogin(): Promise<Session> {
    const clientTime = Date.now();
    const { data, response } = await this.post<unknown>(
      this.rpcUrl("jsonrpc_intern.do", { m: "getUserData2017", v: "i2.2" }),
      "getUserData2017",
      [
        {
          auth: {
            clientTime,
            user: this.config.username,
            otp: totp(this.config.secret!, clientTime),
          },
        },
      ],
    );
    if (data.error) throw UntisError.fromRpc(data.error.code, data.error.message);

    const sessionId = response.headers
      .getSetCookie()
      .map((c) => /JSESSIONID=([^;]+)/.exec(c)?.[1])
      .find(Boolean);
    if (!sessionId) {
      throw new UntisError("auth", "Login mit UNTIS_SECRET fehlgeschlagen (kein Session-Cookie).");
    }
    return { sessionId, createdAt: clientTime, lastUsedAt: clientTime };
  }

  private async ensureSession(): Promise<Session> {
    const s = this.session;
    if (s && Date.now() - s.lastUsedAt < SESSION_IDLE_MS) return s;

    if (!this.loginPromise) {
      this.loginPromise = (this.config.secret ? this.secretLogin() : this.passwordLogin())
        .then((session) => {
          this.session = session;
          return session;
        })
        .finally(() => {
          this.loginPromise = null;
        });
    }
    return this.loginPromise;
  }

  async logout(): Promise<void> {
    const s = this.session;
    this.session = null;
    if (!s) return;
    try {
      await this.post(this.rpcUrl(), "logout", {}, s.sessionId);
    } catch {
      // ignore – the session will expire on its own
    }
  }

  async call<T>(method: string, params: unknown = {}, retried = false): Promise<T> {
    const session = await this.ensureSession();
    const { data } = await this.post<T>(this.rpcUrl(), method, params, session.sessionId);

    if (data.error) {
      if (data.error.code === UNTIS_ERROR_CODES.NOT_AUTHENTICATED && !retried) {
        this.session = null;
        return this.call<T>(method, params, true);
      }
      throw UntisError.fromRpc(data.error.code, data.error.message);
    }

    session.lastUsedAt = Date.now();
    return data.result as T;
  }
}
