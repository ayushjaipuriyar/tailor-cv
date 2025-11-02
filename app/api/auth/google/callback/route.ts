
import { NextResponse, type NextRequest } from "next/server";
import { Buffer } from 'buffer';

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const stored = req.cookies.get('oauth_state')?.value || '';
  if (!code || !state || state !== stored) {
    return new NextResponse('Invalid OAuth state', { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.url.replace(/\/api\/.*$/, '')}/api/auth/google/callback`;
  if (!clientId || !clientSecret) return new NextResponse('Google OAuth not configured', { status: 500 });

  // Exchange code for tokens
  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    } as any)
  });
  if (!tokenResp.ok) {
    const t = await tokenResp.text();
    return new NextResponse(`Token exchange failed: ${t}`, { status: 500 });
  }
  const tokenJson: any = await tokenResp.json();
  const idToken = tokenJson.id_token;
  if (!idToken) return new NextResponse('No id_token received', { status: 500 });

  // Validate id_token via Google's tokeninfo endpoint
  const infoResp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!infoResp.ok) {
    return new NextResponse('Invalid id_token', { status: 401 });
  }
  const info: any = await infoResp.json();

  // Create a simple session cookie: base64(payload).signature
  const payload = {
    sub: info.sub,
    email: info.email,
    name: info.name,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  let cookieVal: string;
  if (process.env.SESSION_SECRET) {
    const sig = require('crypto').createHmac('sha256', process.env.SESSION_SECRET).update(b64).digest('hex');
    cookieVal = `${b64}.${sig}`;
  } else {
    // Development convenience: unsigned cookie (not secure). Set only when SESSION_SECRET not provided.
    cookieVal = b64;
  }

  const res = NextResponse.redirect(new URL('/', req.url));
  res.cookies.set(process.env.SESSION_COOKIE_NAME || 'g_session', cookieVal, { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' });
  // Clear state cookie
  res.cookies.set('oauth_state', '', { maxAge: 0, path: '/' });
  return res;
}
