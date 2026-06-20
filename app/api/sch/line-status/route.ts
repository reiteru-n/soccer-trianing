import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'LINE_CHANNEL_ACCESS_TOKEN not set' }, { status: 500 });
  }

  const headers = { Authorization: `Bearer ${token}` };

  const [quotaRes, consumptionRes] = await Promise.all([
    fetch('https://api.line.me/v2/bot/message/quota', { headers }),
    fetch('https://api.line.me/v2/bot/message/quota/consumption', { headers }),
  ]);

  const [quota, consumption] = await Promise.all([
    quotaRes.json(),
    consumptionRes.json(),
  ]);

  return NextResponse.json({
    quota,
    consumption,
    resetDate: `毎月1日にリセット`,
    tokenPrefix: token.slice(0, 10),
  });
}
