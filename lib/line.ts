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
  if (process.env.LINE_GROUP_ID) return process.env.LINE_GROUP_ID;
  if (!process.env.UPSTASH_REDIS_REST_URL) return null;
  try {
    const redis = await getRedis();
    return await redis.get<string>(GROUP_ID_KEY);
  } catch {
    return null;
  }
}

export async function sendLineMessage(text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;
  const groupId = await getLineGroupId();
  if (!groupId) return;
  try {
    await fetch(LINE_PUSH_API, {
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
  } catch {
    // fire-and-forget
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
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
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
