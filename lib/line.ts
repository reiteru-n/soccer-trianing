const LINE_PUSH_API = 'https://api.line.me/v2/bot/message/push';
const GROUP_ID_KEY = 'sch:line_group_id';

export function isLineConfigured(): boolean {
  return !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
}

async function getRedis() {
  const { Redis } = await import('@upstash/redis');
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export async function getLineGroupId(): Promise<string | null> {
  // Redis takes priority: updated automatically when bot joins a group via Webhook
  if (process.env.UPSTASH_REDIS_REST_URL) {
    try {
      const redis = await getRedis();
      const redisId = await redis.get<string>(GROUP_ID_KEY);
      if (redisId) return redisId;
    } catch {
      // fall through to env var
    }
  }
  return process.env.LINE_GROUP_ID ?? null;
}

export async function sendLineMessage(text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const logRedis = async (data: object) => {
    if (!process.env.UPSTASH_REDIS_REST_URL) return;
    const redis = await getRedis().catch(() => null);
    if (redis) await redis.set('sch:line_send_debug', data).catch(() => {});
  };

  if (!token) {
    await logRedis({ ts: new Date().toISOString(), error: 'LINE_CHANNEL_ACCESS_TOKEN not set' });
    return;
  }
  const groupId = await getLineGroupId();
  if (!groupId) {
    await logRedis({ ts: new Date().toISOString(), error: 'groupId not found (sch:line_group_id empty and LINE_GROUP_ID not set)', tokenPrefix: token.slice(0, 10) });
    return;
  }
  try {
    const res = await fetch(LINE_PUSH_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: groupId,
        messages: [{ type: 'text', text }],
      }),
    });
    const resBody = await res.text();
    await logRedis({ ts: new Date().toISOString(), status: res.status, body: resBody, groupId, tokenPrefix: token.slice(0, 10) });
  } catch (e) {
    await logRedis({ ts: new Date().toISOString(), error: String(e) });
  }
}

export async function verifyLineSignature(body: string, signature: string): Promise<boolean> {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const arr = new Uint8Array(sig);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  const expected = btoa(binary);
  return expected === signature;
}

export async function storeLineGroupId(groupId: string): Promise<void> {
  if (!process.env.UPSTASH_REDIS_REST_URL) return;
  try {
    const redis = await getRedis();
    await redis.set(GROUP_ID_KEY, groupId);
  } catch {
    // ignore
  }
}
