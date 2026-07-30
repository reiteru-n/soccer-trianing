import { NextRequest, NextResponse } from 'next/server';
import { logChange, getIp, getUa, getDeviceId } from '@/lib/logger';

async function makeToken(type: string): Promise<string> {
  const secret = process.env.AUTH_SECRET ?? 'dev-secret';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(type));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export async function POST(req: NextRequest) {
  const { type, password } = await req.json() as { type?: string; password: string };

  if (type === 'member') {
    const expected = process.env.MEMBER_PASSWORD ?? 'SCH26';
    if (password.toLowerCase() !== expected.toLowerCase()) {
      return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  }

  // 個人ページ/チームページを画面上で区別せず、入力されたパスワードがどちらに
  // 一致するかだけで遷移先セッションを決める（家族パスワードは上位互換）。
  const pw = password.toLowerCase();
  const familyPw = process.env.FAMILY_PASSWORD;
  const teamPw = process.env.TEAM_PASSWORD;

  if (familyPw && pw === familyPw.toLowerCase()) {
    const res = NextResponse.json({ ok: true, kind: 'family' });
    res.cookies.set('family_session', await makeToken('family'), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
    logChange({ ts: new Date().toISOString(), action: 'login', detail: 'kind=family', ip: getIp(req), ua: getUa(req), device_id: getDeviceId(req) });
    return res;
  }

  if (teamPw && pw === teamPw.toLowerCase()) {
    const res = NextResponse.json({ ok: true, kind: 'team' });
    res.cookies.set('team_session', await makeToken('team'), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
    logChange({ ts: new Date().toISOString(), action: 'login', detail: 'kind=team', ip: getIp(req), ua: getUa(req), device_id: getDeviceId(req) });
    return res;
  }

  return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('family_session');
  res.cookies.delete('team_session');
  return res;
}
