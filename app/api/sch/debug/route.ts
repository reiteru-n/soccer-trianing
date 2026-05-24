import { NextResponse } from 'next/server';
import { storeLineGroupId } from '@/lib/line';

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
    const [lineDebug, lineSendDebug, lineGroupId, webhookLog] = await Promise.all([
      redis.get('sch:line_debug'),
      redis.get('sch:line_send_debug'),
      redis.get<string>('sch:line_group_id'),
      redis.get('sch:line_webhook_log'),
    ]);
    return NextResponse.json({
      lineDebug,
      lineSendDebug,
      lineGroupId,
      webhookLog,
      envGroupId: process.env.LINE_GROUP_ID
        ? process.env.LINE_GROUP_ID.slice(0, 8) + '…'
        : null,
      hasToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
      hasSecret: !!process.env.LINE_CHANNEL_SECRET,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/sch/debug  body: { setLineGroupId: "Cxxxxxxxxx" }
export async function POST(req: Request) {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return NextResponse.json({ error: 'no redis' }, { status: 500 });
  }
  try {
    const body = await req.json() as Record<string, unknown>;
    if (typeof body.setLineGroupId === 'string' && body.setLineGroupId.startsWith('C')) {
      await storeLineGroupId(body.setLineGroupId);
      return NextResponse.json({ ok: true, lineGroupId: body.setLineGroupId });
    }
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
