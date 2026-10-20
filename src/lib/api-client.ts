import type { ApiErrorBody, UntisErrorKind } from "@/lib/untis/types";

export class ApiError extends Error {
  readonly kind: UntisErrorKind;
  readonly code?: number;
  readonly status: number;

  constructor(body: ApiErrorBody, status: number) {
    super(body.message);
    this.name = "ApiError";
    this.kind = body.kind;
    this.code = body.code;
    this.status = status;
  }
}

export async function fetcher<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new ApiError(
      { kind: "network", message: "Keine Verbindung zum Dashboard-Server." },
      0,
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      data?.error ?? { kind: "network", message: `Serverfehler (HTTP ${response.status}).` },
      response.status,
    );
  }
  return data as T;
}

export function buildUrl(path: string, params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}
