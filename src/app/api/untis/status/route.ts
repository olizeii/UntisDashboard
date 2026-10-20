import { untisRoute } from "@/lib/untis/api";
import { getConnectionInfo } from "@/lib/untis/service";

export function GET() {
  return untisRoute(getConnectionInfo);
}
