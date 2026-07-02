import { NextResponse } from 'next/server';
import { getLineBotQuotas } from '@/lib/line';

export async function GET() {
  const bots = await getLineBotQuotas();
  if (bots.length === 0) {
    return NextResponse.json({ error: 'no LINE bot configured' }, { status: 500 });
  }

  // リセット日 = 翌月1日
  const now = new Date();
  const nextMonth = now.getMonth() === 11
    ? new Date(now.getFullYear() + 1, 0, 1)
    : new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetDate = `${nextMonth.getFullYear()}/${nextMonth.getMonth() + 1}/1`;

  // 代表メンバー数（いずれかのボットが取得できた値）
  const memberCount = bots.find(b => b.memberCount != null)?.memberCount ?? null;

  // 全ボット合計の残枠と、あと何回通知できるか
  const totalRemaining = bots.reduce((sum, b) => sum + Math.max(0, b.limit - b.totalUsage), 0);
  const totalUsage = bots.reduce((sum, b) => sum + b.totalUsage, 0);
  const totalLimit = bots.reduce((sum, b) => sum + b.limit, 0);
  const timesLeft = memberCount ? Math.floor(totalRemaining / memberCount) : null;

  return NextResponse.json({
    bots,
    memberCount,
    totalUsage,
    totalLimit,
    totalRemaining,
    timesLeft,
    resetDate,
  });
}
