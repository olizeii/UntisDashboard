import { NextResponse, type NextRequest } from "next/server";

/** Constant-time string comparison to avoid leaking the password via timing. */
function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * Optional HTTP Basic Auth for the whole dashboard (pages + API).
 * Enabled when DASHBOARD_PASSWORD is set.
 */
export function proxy(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();
  const user = process.env.DASHBOARD_USER || "admin";

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = atob(header.slice(6));
    } catch {
      // malformed header -> treat as unauthenticated
    }
    const [u = "", ...rest] = decoded.split(":");
    if (safeEqual(u, user) && safeEqual(rest.join(":"), password)) return NextResponse.next();
  }

  return new NextResponse("Anmeldung erforderlich", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Untis Dashboard", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
