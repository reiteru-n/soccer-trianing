import { NextResponse } from 'next/server';

// Vercelがデプロイごとに自動設定するシステム環境変数。UpdateBannerの新ビルド検知に使う。
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev',
  });
}
