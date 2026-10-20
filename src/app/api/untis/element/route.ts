import type { NextRequest } from "next/server";
import { parseElementParams, untisRoute } from "@/lib/untis/api";
import { getElementStatus, resolveMoment } from "@/lib/untis/service";

/** GET /api/untis/element?type=teacher&id=12&date=2026-10-20&time=10:15 */
export function GET(request: NextRequest) {
  return untisRoute(async () => {
    const params = request.nextUrl.searchParams;
    const { type, id } = parseElementParams(params);
    return getElementStatus(type, id, resolveMoment(params.get("date"), params.get("time")));
  });
}
