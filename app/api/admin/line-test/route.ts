import { NextResponse } from 'next/server';
import { getLineGroupId, isLineConfigured } from '@/lib/line';

export async function GET(req: Request) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const secret = process.env.LINE_CHANNEL_SECRET;
  const groupId = await getLineGroupId();

  const { searchParams } = new URL(req.url);
  if (searchParams.get('send') === '1') {
    if (!token || !groupId) {
      return NextResponse.json({ error: 'not configured', tokenSet: !!token, groupId });
    }
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: groupId, messages: [{ type: 'text', text: '🔧 SCH LINE通知 テスト送信\nhttps://soccer-trianing.vercel.app/sch' }] }),
    });
    const body = await res.text();
    return NextResponse.json({ lineStatus: res.status, lineBody: body, groupId });
  }

  return NextResponse.json({
    tokenSet: !!token,
    tokenPrefix: token ? token.slice(0, 10) + '...' : null,
    secretSet: !!secret,
    configured: isLineConfigured(),
    groupId: groupId ?? null,
  });
}
