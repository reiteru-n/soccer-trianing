import { NextRequest, NextResponse } from 'next/server';
import { saveRefreshToken } from '@/lib/youtubeAuth';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');
  const base = req.nextUrl.origin;
  const testPage = `${base}/videos/youtube-test`;

  if (error) {
    return NextResponse.redirect(`${testPage}?error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${testPage}?error=no_code`);
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(`${testPage}?error=env_missing`);
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    return NextResponse.redirect(`${testPage}?error=token_exchange_failed`);
  }
  const data = await res.json();
  if (!data.refresh_token) {
    return NextResponse.redirect(`${testPage}?error=no_refresh_token`);
  }
  await saveRefreshToken(data.refresh_token);
  return NextResponse.redirect(`${testPage}?connected=1`);
}
