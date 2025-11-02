import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protect non-API pages: require either a valid session cookie (Google OAuth) or Basic Auth when configured.
const USER = process.env.BASIC_AUTH_USER;
const PASS = process.env.BASIC_AUTH_PASS;
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || "g_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "";

function verifySessionCookie(cookie?: string) {
  if (!cookie) return false;
  try {
    // Support two cookie formats:
    // - signed: <base64>.<hmac>
    // - unsigned (development): just <base64>
    const parts = cookie.split('.');
    const b64 = parts[0];
    const sig = parts.length > 1 ? parts[1] : undefined;
    if (!b64) return false;
    const payloadJson = Buffer.from(b64, 'base64').toString('utf8');
    // If SESSION_SECRET is configured, require a valid signature
    if (SESSION_SECRET) {
      if (!sig) return false;
      const expected = require('crypto').createHmac('sha256', SESSION_SECRET).update(b64).digest('hex');
      if (expected !== sig) return false;
    }
    const payload = JSON.parse(payloadJson);
    if (!payload || typeof payload !== 'object') return false;
    if (payload.exp && Date.now() > payload.exp) return false;
    return true;
  } catch (e) {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow API, Next internals, static assets and files to pass through
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.startsWith('/static') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  // If a valid session cookie exists, allow
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (SESSION_SECRET && cookie && verifySessionCookie(cookie)) return NextResponse.next();

  // If Basic auth is configured, allow with Basic credentials
  if (USER && PASS) {
    const auth = req.headers.get('authorization') || '';
    if (auth.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
        const [u, p] = decoded.split(':');
        if (u === USER && p === PASS) return NextResponse.next();
      } catch (e) {}
    }
    return new NextResponse('Authentication required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Protected"' } });
  }

  // Otherwise redirect to Google OAuth start
  const startUrl = new URL('/api/auth/google/start', req.url);
  return NextResponse.redirect(startUrl);
}

export const config = {
  matcher: ['/((?!api|_next|static|favicon.ico).*)'],
};
