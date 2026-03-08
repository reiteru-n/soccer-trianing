import { NextResponse } from 'next/server';
import { INITIAL_LIFTING_RECORDS, INITIAL_PRACTICE_NOTES, INITIAL_TRAINING_MENU, INITIAL_BODY_RECORDS } from '@/lib/data';

interface AppData {
  liftingRecords: unknown[];
  practiceNotes: unknown[];
  bodyRecords: unknown[];
  trainingMenu: unknown[];
  trainingLogs: unknown[];
  childBirthDate: string;
}

const DATA_KEY = 'takuto_app_data';

async function readData(): Promise<AppData | null> {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return redis.get<AppData>(DATA_KEY);
  }
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
      bodyRecords: INITIAL_BODY_RECORDS,
      trainingMenu: INITIAL_TRAINING_MENU,
      trainingLogs: [],
      childBirthDate: "",
    });
  }
  // Fill missing fields for existing data (migration)
  return NextResponse.json({
    liftingRecords: data.liftingRecords ?? INITIAL_LIFTING_RECORDS,
    practiceNotes: data.practiceNotes ?? INITIAL_PRACTICE_NOTES,
    bodyRecords: data.bodyRecords ?? INITIAL_BODY_RECORDS,
    trainingMenu: data.trainingMenu ?? INITIAL_TRAINING_MENU,
    trainingLogs: data.trainingLogs ?? [],
    childBirthDate: (data as any).childBirthDate ?? "",
  });
}

export async function POST(req: Request) {
  try {
  const body = await req.json() as Record<string, unknown>;
  const current = await readData() ?? {
    liftingRecords: INITIAL_LIFTING_RECORDS,
    practiceNotes: INITIAL_PRACTICE_NOTES,
    bodyRecords: INITIAL_BODY_RECORDS,
    trainingMenu: INITIAL_TRAINING_MENU,
    trainingLogs: [],
    childBirthDate: "",
  };
  await writeData({
    liftingRecords: (body.liftingRecords as unknown[] | undefined) ?? current.liftingRecords,
    practiceNotes: (body.practiceNotes as unknown[] | undefined) ?? current.practiceNotes,
    bodyRecords: (body.bodyRecords as unknown[] | undefined) ?? current.bodyRecords ?? INITIAL_BODY_RECORDS,
    trainingMenu: (body.trainingMenu as unknown[] | undefined) ?? current.trainingMenu ?? INITIAL_TRAINING_MENU,
    trainingLogs: (body.trainingLogs as unknown[] | undefined) ?? current.trainingLogs ?? [],
    childBirthDate: (typeof body.childBirthDate === "string" ? body.childBirthDate : (typeof (current as any).childBirthDate === "string" ? (current as any).childBirthDate : "")),
  });
  return NextResponse.json({ ok: true });
  } catch(err) {
    console.error("POST error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
