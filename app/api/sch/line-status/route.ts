import { NextResponse } from 'next/server';

async function getRedis() {
  const { Redis } = await import('@upstash/redis');
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export async function GET() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'LINE_CHANNEL_ACCESS_TOKEN not set' }, { status: 500 });
  }

  const headers = { Authorization: `Bearer ${token}` };

  // Reset date = 1st of next month
  const now = new Date();
  const nextMonth = now.getMonth() === 11
    ? new Date(now.getFullYear() + 1, 0, 1)
    : new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetDate = `${nextMonth.getFullYear()}/${nextMonth.getMonth() + 1}/1`;

  // Group member count from LINE API
  let memberCount: number | null = null;
  if (process.env.UPSTASH_REDIS_REST_URL) {
    try {
      const redis = await getRedis();
      const groupId = await redis.get<string>('sch:line_group_id');
      if (groupId) {
        const countRes = await fetch(
          `https://api.line.me/v2/bot/group/${groupId}/members/count`,
          { headers },
        );
        if (countRes.ok) {
          const countData = await countRes.json() as { count?: number };
          memberCount = countData.count ?? null;
        }
      }
    } catch { /* ignore */ }
  }

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
    memberCount,
    resetDate,
    tokenPrefix: token.slice(0, 10),
  });
}
