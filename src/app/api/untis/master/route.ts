import { untisRoute } from "@/lib/untis/api";
import { getMasterData } from "@/lib/untis/service";

export function GET() {
  return untisRoute(getMasterData);
}
