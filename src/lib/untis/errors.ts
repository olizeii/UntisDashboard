import type { ApiErrorBody, UntisErrorKind } from "./types";

/**
 * Known WebUntis JSON-RPC error codes.
 * See https://untis-sr.ch/wp-content/uploads/2019/11/2018-09-20-WebUntis_JSON_RPC_API.pdf
 */
export const UNTIS_ERROR_CODES = {
  NOT_AUTHENTICATED: -8520,
  BAD_CREDENTIALS: -8504,
  NO_RIGHT: -8509,
  INVALID_SCHOOL: -8500,
  INVALID_CLIENT: -8502,
  USER_BLOCKED: -8998,
  NO_ALLOWED_DATE: -7004,
  INVALID_ELEMENT_TYPE: -7002,
  INVALID_ELEMENT_ID: -7003,
} as const;

const HTTP_STATUS: Record<UntisErrorKind, number> = {
  config: 503,
  auth: 401,
  permission: 403,
  network: 502,
  timeout: 504,
  "not-found": 404,
  "bad-request": 400,
  rpc: 502,
};

export class UntisError extends Error {
  readonly kind: UntisErrorKind;
  readonly code?: number;

  constructor(kind: UntisErrorKind, message: string, code?: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "UntisError";
    this.kind = kind;
    this.code = code;
  }

  get status() {
    return HTTP_STATUS[this.kind];
  }

  toJSON(): ApiErrorBody {
    return { kind: this.kind, message: this.message, code: this.code };
  }

  static fromRpc(code: number, message: string): UntisError {
    switch (code) {
      case UNTIS_ERROR_CODES.BAD_CREDENTIALS:
        return new UntisError("auth", "Benutzername oder Passwort ist ungültig.", code);
      case UNTIS_ERROR_CODES.USER_BLOCKED:
        return new UntisError("auth", "Der WebUntis-Benutzer ist gesperrt.", code);
      case UNTIS_ERROR_CODES.INVALID_SCHOOL:
        return new UntisError(
          "config",
          "Der Schulname (UNTIS_SCHOOL) ist auf diesem Server unbekannt. Gemeint ist der Login-Name " +
            "der Schule – er steht in der WebUntis-URL nach ?school= bzw. #/basic/login.",
          code,
        );
      case UNTIS_ERROR_CODES.NOT_AUTHENTICATED:
        return new UntisError("auth", "Die WebUntis-Session ist abgelaufen.", code);
      case UNTIS_ERROR_CODES.NO_RIGHT:
        return new UntisError(
          "permission",
          "Der WebUntis-Benutzer hat keine Berechtigung für diese Abfrage.",
          code,
        );
      case UNTIS_ERROR_CODES.NO_ALLOWED_DATE:
        return new UntisError(
          "bad-request",
          "Für dieses Datum sind keine Daten freigegeben (außerhalb des Schuljahres?).",
          code,
        );
      case UNTIS_ERROR_CODES.INVALID_ELEMENT_ID:
      case UNTIS_ERROR_CODES.INVALID_ELEMENT_TYPE:
        return new UntisError("not-found", "Das gesuchte Element existiert nicht.", code);
      default:
        return new UntisError("rpc", `WebUntis-Fehler: ${message}`, code);
    }
  }
}

export function toUntisError(error: unknown): UntisError {
  if (error instanceof UntisError) return error;
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return new UntisError("timeout", "Der WebUntis-Server antwortet nicht (Timeout).", undefined, {
        cause: error,
      });
    }
    const code = (error.cause as { code?: string } | undefined)?.code;
    const reason =
      code === "ENOTFOUND" || code === "EAI_AGAIN"
        ? "Server-Adresse nicht gefunden – stimmt UNTIS_SERVER?"
        : code === "ECONNREFUSED"
          ? "Verbindung abgelehnt."
          : code === "ECONNRESET"
            ? "Verbindung wurde unterbrochen."
            : code?.startsWith("CERT_") || code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
              ? "TLS-Zertifikat ungültig."
              : error.message;
    return new UntisError("network", `WebUntis-Server nicht erreichbar: ${reason}`, undefined, {
      cause: error,
    });
  }
  return new UntisError("network", "Unbekannter Fehler bei der Verbindung zu WebUntis.");
}
