import type { NextRequest } from "next/server";
import { untisRoute } from "@/lib/untis/api";
import { getFreeRooms, resolveMoment } from "@/lib/untis/service";

/** GET /api/untis/rooms?date=2026-10-20&time=10:15 – free and occupied rooms */
export function GET(request: NextRequest) {
  return untisRoute(() => {
    const params = request.nextUrl.searchParams;
    return getFreeRooms(resolveMoment(params.get("date"), params.get("time")));
  });
}
