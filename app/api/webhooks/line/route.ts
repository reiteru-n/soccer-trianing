import { NextResponse } from 'next/server';
import { matchBotBySignature, storeLineGroupId } from '@/lib/line';

async function getRedis() {
  const { Redis } = await import('@upstash/redis');
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('x-line-signature') ?? '';

  // どのボット宛のWebhookか署名で判別（複数ボットが同じURLを共有可能）
  const bot = await matchBotBySignature(body, sig);
  const sigOk = !!bot;

  // Always log what we received (for debugging)
  if (process.env.UPSTASH_REDIS_REST_URL) {
    try {
      const parsed = JSON.parse(body) as {
        events?: Array<{ type?: string; source?: { type?: string; groupId?: string } }>;
        destination?: string;
      };
      const redis = await getRedis();
      await redis.set('sch:line_webhook_log', {
        ts: new Date().toISOString(),
        sigOk,
        matchedBot: bot?.index ?? null,
        destination: parsed.destination,
        events: (parsed.events ?? []).map(e => ({
          type: e.type,
          sourceType: e.source?.type,
          groupId: e.source?.groupId,
        })),
      });
    } catch {
      // ignore
    }
  }

  if (!bot) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    const data = JSON.parse(body) as {
      events?: Array<{ type?: string; source?: { type?: string; groupId?: string } }>;
    };
    for (const event of data.events ?? []) {
      // Only capture join events to avoid test group messages overwriting real group ID
      if (event.type === 'join' && event.source?.type === 'group' && event.source.groupId) {
        // 一致したボット専用のgroupIdキーに保存
        await storeLineGroupId(event.source.groupId, bot.groupIdKey);
        console.log(`[LINE webhook] Bot${bot.index} Group ID captured from join:`, event.source.groupId);
        break;
      }
    }
  } catch {
    // ignore parse errors — still return 200 to LINE
  }

  return NextResponse.json({ ok: true });
}
