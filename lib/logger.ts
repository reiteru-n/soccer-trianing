import type { AccessLogEntry, ChangeLogEntry } from './types';

const MAX_ENTRIES = 3000;

async function getRedis() {
  const { Redis } = await import('@upstash/redis');
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

function hasRedis() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export async function logAccess(entry: AccessLogEntry): Promise<void> {
  if (!hasRedis()) return;
  try {
    const redis = await getRedis();
    await redis.lpush('admin:access_log', JSON.stringify(entry));
    await redis.ltrim('admin:access_log', 0, MAX_ENTRIES - 1);
  } catch {
    // silent fail — logging should never break the main flow
  }
}

export async function logChange(entry: ChangeLogEntry): Promise<void> {
  if (!hasRedis()) return;
  try {
    const redis = await getRedis();
    await redis.lpush('admin:change_log', JSON.stringify(entry));
    await redis.ltrim('admin:change_log', 0, MAX_ENTRIES - 1);
  } catch {
    // silent fail
  }
}

export function getIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

export function getUa(req: Request): string {
  return req.headers.get('user-agent') ?? 'unknown';
}
