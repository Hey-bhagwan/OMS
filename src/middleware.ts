import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || "koa-living-production-super-secret-key-32-chars-min"
);

const SESSION_COOKIE_NAME = "koa_session_token";

// Routes that do NOT require authentication
const PUBLIC_API_PATHS = [
  "/api/auth/login",
  "/api/auth/me",           // handles its own 401
  "/api/webhooks/shiprocket",
  "/api/webhooks/tracking",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only guard API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Allow public paths through
  if (PUBLIC_API_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Check for session cookie
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized: no session" },
      { status: 401 }
    );
  }

  // Verify JWT is valid and not expired
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);

    // Attach user info as headers so route handlers can trust them
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-user-id", payload.id as string);
    requestHeaders.set("x-user-email", payload.email as string);
    requestHeaders.set("x-user-role", payload.role as string);

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    // JWT expired or tampered
    const response = NextResponse.json(
      { error: "Unauthorized: invalid or expired session" },
      { status: 401 }
    );
    // Clear the bad cookie
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: ["/api/:path*"],
};
