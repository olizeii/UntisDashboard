import "server-only";

import { DEFAULT_TIMEZONE } from "@/lib/time";
import { UntisError } from "./errors";

export interface UntisConfig {
  mock: boolean;
  /** Host only, e.g. "mese.webuntis.com" */
  server: string;
  school: string;
  username: string;
  password?: string;
  /** Base32 app secret (WebUntis "Freigaben -> Anzeigen"). Used instead of the password if set. */
  secret?: string;
  clientName: string;
  timezone: string;
  timeoutMs: number;
  maxConcurrency: number;
}

function normalizeServer(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");
}

function intFromEnv(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

let cached: UntisConfig | null = null;

/**
 * Reads the WebUntis configuration from environment variables.
 * Throws a `config` UntisError when the live mode is missing required values.
 */
export function getUntisConfig(): UntisConfig {
  if (cached) return cached;

  const env = process.env;
  const mock = env.UNTIS_MOCK === "true" || env.UNTIS_MOCK === "1";
  const config: UntisConfig = {
    mock,
    server: normalizeServer(env.UNTIS_SERVER ?? ""),
    school: (env.UNTIS_SCHOOL ?? "").trim(),
    username: (env.UNTIS_USERNAME ?? "").trim(),
    password: env.UNTIS_PASSWORD || undefined,
    secret: env.UNTIS_SECRET?.replace(/\s+/g, "") || undefined,
    clientName: env.UNTIS_CLIENT_NAME?.trim() || "untis-dashboard",
    timezone: env.UNTIS_TIMEZONE?.trim() || DEFAULT_TIMEZONE,
    timeoutMs: intFromEnv(env.UNTIS_TIMEOUT_MS, 15_000),
    maxConcurrency: intFromEnv(env.UNTIS_MAX_CONCURRENCY, 6),
  };

  if (mock) {
    config.server ||= "demo.webuntis.local";
    config.school ||= "Demo-HTL";
    cached = config;
    return config;
  }

  const missing = [
    !config.server && "UNTIS_SERVER",
    !config.school && "UNTIS_SCHOOL",
    !config.username && "UNTIS_USERNAME",
    !config.password && !config.secret && "UNTIS_PASSWORD oder UNTIS_SECRET",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new UntisError(
      "config",
      `WebUntis ist nicht konfiguriert. Fehlende Variablen in .env.local: ${missing.join(", ")}. ` +
        "Für Testdaten UNTIS_MOCK=true setzen.",
    );
  }

  cached = config;
  return config;
}

/** Non-throwing variant for status displays. */
export function peekUntisConfig(): { config: UntisConfig | null; error: UntisError | null } {
  try {
    return { config: getUntisConfig(), error: null };
  } catch (error) {
    return { config: null, error: error as UntisError };
  }
}
