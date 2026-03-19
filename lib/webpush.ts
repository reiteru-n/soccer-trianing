import webpush from 'web-push';

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const SUBS_KEY = 'sch:push_subscriptions';

function isConfigured() {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

if (isConfigured()) {
  webpush.setVapidDetails(
    'mailto:admin@soccer-trianing.vercel.app',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

async function getRedis() {
  const { Redis } = await import('@upstash/redis');
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export async function getSubscriptions(): Promise<webpush.PushSubscription[]> {
  const redis = await getRedis();
  const raw = await redis.lrange<string>(SUBS_KEY, 0, -1);
  return raw.map((s) => (typeof s === 'string' ? JSON.parse(s) : s));
}

export async function addSubscription(sub: webpush.PushSubscription): Promise<void> {
  const redis = await getRedis();
  const existing = await getSubscriptions();
  if (existing.some((s) => s.endpoint === sub.endpoint)) return; // already registered
  await redis.lpush(SUBS_KEY, JSON.stringify(sub));
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const redis = await getRedis();
  const existing = await getSubscriptions();
  const filtered = existing.filter((s) => s.endpoint !== endpoint);
  await redis.del(SUBS_KEY);
  if (filtered.length > 0) {
    await redis.rpush(SUBS_KEY, ...filtered.map((s) => JSON.stringify(s)));
  }
}

export async function sendPushToAll(payload: {
  title: string;
  body: string;
  url?: string;
}): Promise<void> {
  if (!isConfigured()) return;
  const subs = await getSubscriptions();
  if (subs.length === 0) return;

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(sub, JSON.stringify(payload))
    )
  );

  // Remove expired / invalid subscriptions (410 Gone)
  const toRemove: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const err = r.reason as { statusCode?: number };
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        toRemove.push(subs[i].endpoint);
      }
    }
  });

  for (const endpoint of toRemove) {
    await removeSubscription(endpoint);
  }
}

export { isConfigured as isWebPushConfigured };
export const vapidPublicKey = VAPID_PUBLIC_KEY;
