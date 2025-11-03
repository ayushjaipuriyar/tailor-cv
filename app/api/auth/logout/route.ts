import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/', req.url));
  // Clear session and any leftover oauth_state
  const cookieName = process.env.SESSION_COOKIE_NAME || 'g_session';
  res.cookies.set(cookieName, '', { maxAge: 0, path: '/' });
  res.cookies.set('oauth_state', '', { maxAge: 0, path: '/' });
  return res;
}
