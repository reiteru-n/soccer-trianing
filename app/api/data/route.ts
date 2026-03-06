import { NextResponse } from 'next/server';
import { INITIAL_LIFTING_RECORDS, INITIAL_PRACTICE_NOTES } from '@/lib/data';

interface AppData {
  liftingRecords: unknown[];
  practiceNotes: unknown[];
}

const DATA_KEY = 'takuto_app_data';

async function readData(): Promise<AppData | null> {
  // Production: Upstash Redis
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return redis.get<AppData>(DATA_KEY);
  }
  // Development: local JSON file
  try {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const txt = readFileSync(join(process.cwd(), 'dev-data.json'), 'utf-8');
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

async function writeData(data: AppData): Promise<void> {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    await redis.set(DATA_KEY, data);
    return;
  }
  const { writeFileSync } = await import('fs');
  const { join } = await import('path');
  writeFileSync(join(process.cwd(), 'dev-data.json'), JSON.stringify(data, null, 2));
}

export async function GET() {
  const data = await readData();
  if (!data) {
    return NextResponse.json({
      liftingRecords: INITIAL_LIFTING_RECORDS,
      practiceNotes: INITIAL_PRACTICE_NOTES,
    });
  }
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json() as Partial<AppData>;
  const current = await readData() ?? {
    liftingRecords: INITIAL_LIFTING_RECORDS,
    practiceNotes: INITIAL_PRACTICE_NOTES,
  };
  await writeData({
    liftingRecords: body.liftingRecords ?? current.liftingRecords,
    practiceNotes: body.practiceNotes ?? current.practiceNotes,
  });
  return NextResponse.json({ ok: true });
}
