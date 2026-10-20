import "server-only";

import { connection } from "next/server";
import { UntisError, toUntisError } from "./errors";
import type { ElementType } from "./types";

/**
 * Wraps a route handler: always runs at request time, returns JSON and maps
 * errors to `{ error: { kind, message, code } }` with a fitting HTTP status.
 */
export async function untisRoute<T>(load: () => Promise<T>): Promise<Response> {
  await connection();
  try {
    return Response.json(await load(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const error = toUntisError(e);
    if (error.status >= 500) console.error(`[untis] ${error.kind}: ${error.message}`, error.cause ?? "");
    return Response.json({ error: error.toJSON() }, { status: error.status });
  }
}

const ELEMENT_TYPES: ElementType[] = ["teacher", "class", "room", "subject"];

export function parseElementParams(params: URLSearchParams): { type: ElementType; id: number } {
  const type = params.get("type") as ElementType | null;
  const id = Number(params.get("id"));
  if (!type || !ELEMENT_TYPES.includes(type)) {
    throw new UntisError("bad-request", `Ungültiger Typ. Erlaubt: ${ELEMENT_TYPES.join(", ")}.`);
  }
  if (!Number.isInteger(id) || id <= 0) {
    throw new UntisError("bad-request", "Ungültige Element-ID.");
  }
  return { type, id };
}
