import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.url.replace(/\/api\/.*$/, '')}/api/auth/google/callback`;
  if (!clientId) return new NextResponse('Google client id not configured', { status: 500 });

  const state = Math.random().toString(36).slice(2);
  const scope = encodeURIComponent('openid email profile');
  const url = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${encodeURIComponent(state)}&access_type=offline&prompt=consent`;

  const res = NextResponse.redirect(url);
  // store state in cookie (short lived)
  res.cookies.set('oauth_state', state, { httpOnly: true, sameSite: 'lax', path: '/' });
  return res;
}
