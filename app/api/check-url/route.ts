import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    });
    // 404のみ「リンク切れ」。認証要求(401/403)やHEAD非対応(405)はリンク有効とみなす
    const broken = res.status === 404;
    return NextResponse.json({ ok: !broken, status: res.status });
  } catch {
    // ネットワーク到達不能（DNS失敗など）のみリンク切れ
    return NextResponse.json({ ok: false, status: 0 });
  }
}
