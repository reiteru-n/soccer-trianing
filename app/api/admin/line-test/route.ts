import { NextResponse } from 'next/server';
import { getLineGroupId, sendLineMessage, isLineConfigured } from '@/lib/line';

export async function GET() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const secret = process.env.LINE_CHANNEL_SECRET;
  const groupId = await getLineGroupId();

  return NextResponse.json({
    tokenSet: !!token,
    tokenPrefix: token ? token.slice(0, 10) + '...' : null,
    secretSet: !!secret,
    configured: isLineConfigured(),
    groupId: groupId ?? null,
  });
}

export async function POST() {
  const groupId = await getLineGroupId();
  if (!groupId) {
    return NextResponse.json({ error: 'group ID not found' }, { status: 400 });
  }
  await sendLineMessage('🔧 SCH LINE通知 テスト送信\nhttps://soccer-trianing.vercel.app/sch');
  return NextResponse.json({ ok: true, groupId });
}
