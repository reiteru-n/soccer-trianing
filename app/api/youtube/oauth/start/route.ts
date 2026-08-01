import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_REDIRECT_URI が未設定です' },
      { status: 500 },
    );
  }
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube');
  url.searchParams.set('access_type', 'offline');
  // 毎回同意画面を出してrefresh_tokenを確実に取得する（テスト中の再連携用）
  url.searchParams.set('prompt', 'consent');
  return NextResponse.redirect(url.toString());
}
