/**
 * dev-sch.json のメンバーデータを Upstash Redis に投入するスクリプト
 * 実行: npx tsx scripts/seed-sch-members.ts
 */
import 'dotenv/config';
import { Redis } from '@upstash/redis';
import members from '../dev-sch.json' assert { type: 'json' };

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

await redis.set('sch:members', members.members);
console.log(`✓ sch:members に ${members.members.length} 名を投入しました`);

process.exit(0);
