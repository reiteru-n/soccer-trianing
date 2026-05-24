import { NextResponse } from 'next/server';

async function getRedis() {
  const { Redis } = await import('@upstash/redis');
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export async function GET() {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return NextResponse.json({ error: 'no redis' }, { status: 500 });
  }
  try {
    const redis = await getRedis();
    const [lineDebug, lineSendDebug, lineGroupId] = await Promise.all([
      redis.get('sch:line_debug'),
      redis.get('sch:line_send_debug'),
      redis.get<string>('sch:line_group_id'),
    ]);
    return NextResponse.json({
      lineDebug,
      lineSendDebug,
      lineGroupId,
      envGroupId: process.env.LINE_GROUP_ID
        ? process.env.LINE_GROUP_ID.slice(0, 8) + '…'
        : null,
      hasToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
