import type { NextRequest } from "next/server";
import { untisRoute } from "@/lib/untis/api";
import { getDashboardStats, resolveMoment } from "@/lib/untis/service";

/** GET /api/untis/stats?date=2026-10-20&time=10:15 – dashboard KPIs */
export function GET(request: NextRequest) {
  return untisRoute(() => {
    const params = request.nextUrl.searchParams;
    return getDashboardStats(resolveMoment(params.get("date"), params.get("time")));
  });
}
