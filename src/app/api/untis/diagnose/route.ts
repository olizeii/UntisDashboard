import { untisRoute } from "@/lib/untis/api";
import { UntisError } from "@/lib/untis/errors";
import { runDiagnostics } from "@/lib/untis/service";

/**
 * GET /api/untis/diagnose – which WebUntis queries does the account allow?
 * Development only: it reveals details about the account's permissions.
 */
export function GET() {
  return untisRoute(async () => {
    if (process.env.NODE_ENV === "production") {
      throw new UntisError("not-found", "Die Diagnose ist nur im Entwicklungsmodus (npm run dev) verfügbar.");
    }
    return runDiagnostics();
  });
}
