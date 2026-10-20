import type { NextRequest } from "next/server";
import { addDays, startOfWeek } from "@/lib/time";
import { untisRoute } from "@/lib/untis/api";
import { getSubstitutions, resolveMoment } from "@/lib/untis/service";

/** GET /api/untis/substitutions?date=2026-10-20&range=day|week */
export function GET(request: NextRequest) {
  return untisRoute(() => {
    const params = request.nextUrl.searchParams;
    const { date } = resolveMoment(params.get("date"));
    if (params.get("range") === "week") {
      const monday = startOfWeek(date);
      return getSubstitutions(monday, addDays(monday, 5));
    }
    return getSubstitutions(date, date);
  });
}
