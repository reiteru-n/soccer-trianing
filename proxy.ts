import { NextRequest, NextResponse } from 'next/server';

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

async function hasValidCookie(req: NextRequest, cookieName: string, type: string): Promise<boolean> {
  const val = req.cookies.get(cookieName)?.value;
  if (!val) return false;
  return val === (await makeToken(type));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow login pages and auth API
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // SCH calendar ICS: public (Apple/Google Calendar が cookie なしでアクセスするため)
  if (pathname === '/api/sch/calendar') {
    return NextResponse.next();
  }

  // SCH API: requires team session
  if (pathname.startsWith('/api/sch')) {
    if (!(await hasValidCookie(req, 'team_session', 'team'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Personal data API: requires family session
  if (pathname.startsWith('/api/data')) {
    if (!(await hasValidCookie(req, 'family_session', 'family'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Admin APIs: requires family session
  if (pathname.startsWith('/api/admin/')) {
    if (!(await hasValidCookie(req, 'family_session', 'family'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // SCH admin page: requires family session (管理者は家族パスワードでアクセス)
  if (pathname.startsWith('/sch/admin')) {
    if (!(await hasValidCookie(req, 'family_session', 'family'))) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('type', 'family');
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // SCH page: requires team session
  if (pathname.startsWith('/sch')) {
    if (!(await hasValidCookie(req, 'team_session', 'team'))) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('type', 'team');
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Personal pages: requires family session
  const personalPaths = ['/', '/lifting', '/notes', '/training'];
  const isPersonal = personalPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (isPersonal) {
    if (!(await hasValidCookie(req, 'family_session', 'family'))) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('type', 'family');
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
