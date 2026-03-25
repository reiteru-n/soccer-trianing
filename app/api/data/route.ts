import { NextResponse } from 'next/server';
import { INITIAL_LIFTING_RECORDS, INITIAL_PRACTICE_NOTES, INITIAL_TRAINING_MENU, INITIAL_BODY_RECORDS } from '@/lib/data';
import { logAccess, getIp, getUa, getDeviceId } from '@/lib/logger';

// キーを種別ごとに分割してサイズ上限を回避
const KEYS = {
  notes:       'takuto:notes',
  lifting:     'takuto:lifting',
  body:        'takuto:body',
  menu:        'takuto:menu',
  logs:        'takuto:logs',
  config:      'takuto:config',
  performance: 'takuto:performance',
  perfConfig:  'takuto:perf_config',
} as const;

// 旧キー（初回のみマイグレーション用）
const LEGACY_KEY = 'takuto_app_data';

interface AppData {
  liftingRecords: unknown[];
  practiceNotes: unknown[];
  bodyRecords: unknown[];
  trainingMenu: unknown[];
  trainingLogs: unknown[];
  childBirthDate: string;
  performanceRecords: unknown[];
  customMetrics: unknown[];
}

// ----- Redis helpers -----
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

// ----- 読み込み -----
async function readData(): Promise<AppData | null> {
  if (hasRedis()) {
    const redis = await getRedis();

    // 新キーから一括読み込み
    const [notes, lifting, body, menu, logs, config, perf, perfCfg] = await redis.mget<unknown[]>(
      KEYS.notes, KEYS.lifting, KEYS.body, KEYS.menu, KEYS.logs, KEYS.config, KEYS.performance, KEYS.perfConfig
    );

    // いずれかのキーがあれば新形式
    if (notes || lifting || body || menu || logs || config) {
      return {
        practiceNotes:     (notes   as unknown[]) ?? [],
        liftingRecords:    (lifting as unknown[]) ?? [],
        bodyRecords:       (body    as unknown[]) ?? [],
        trainingMenu:      (menu    as unknown[]) ?? [],
        trainingLogs:      (logs    as unknown[]) ?? [],
        childBirthDate:    ((config as any)?.childBirthDate) ?? '',
        performanceRecords: (perf   as unknown[]) ?? [],
        customMetrics:     (perfCfg as unknown[]) ?? [],
      };
    }

    // 旧キーが残っていればマイグレーション
    const legacy = await redis.get<AppData>(LEGACY_KEY);
    if (legacy) {
      await migrateToSplitKeys(redis, legacy);
      return legacy;
    }

    return null;
  }

  // ローカル開発: ファイル読み込み
  try {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const txt = readFileSync(join(process.cwd(), 'dev-data.json'), 'utf-8');
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

// ----- マイグレーション（旧キー → 分割キー）-----
async function migrateToSplitKeys(redis: any, data: AppData): Promise<void> {
  await redis.mset({
    [KEYS.notes]:   data.practiceNotes  ?? [],
    [KEYS.lifting]: data.liftingRecords ?? [],
    [KEYS.body]:    data.bodyRecords    ?? [],
    [KEYS.menu]:    data.trainingMenu   ?? [],
    [KEYS.logs]:    data.trainingLogs   ?? [],
    [KEYS.config]:  { childBirthDate: (data as any).childBirthDate ?? '' },
  });
  await redis.del(LEGACY_KEY);
}

// ----- 書き込み（部分更新対応）-----
async function writePartial(body: Partial<Record<string, unknown>>): Promise<void> {
  if (hasRedis()) {
    const redis = await getRedis();
    const updates: Record<string, unknown> = {};
    if ('practiceNotes'      in body) updates[KEYS.notes]       = body.practiceNotes;
    if ('liftingRecords'     in body) updates[KEYS.lifting]     = body.liftingRecords;
    if ('bodyRecords'        in body) updates[KEYS.body]        = body.bodyRecords;
    if ('trainingMenu'       in body) updates[KEYS.menu]        = body.trainingMenu;
    if ('trainingLogs'       in body) updates[KEYS.logs]        = body.trainingLogs;
    if ('childBirthDate'     in body) updates[KEYS.config]      = { childBirthDate: body.childBirthDate };
    if ('performanceRecords' in body) updates[KEYS.performance] = body.performanceRecords;
    if ('customMetrics'      in body) updates[KEYS.perfConfig]  = body.customMetrics;
    if (Object.keys(updates).length > 0) {
      await redis.mset(updates);
    }
    return;
  }
  // ローカル開発: ファイル書き込み（全体マージ）
  const { readFileSync, writeFileSync } = await import('fs');
  const { join } = await import('path');
  const path = join(process.cwd(), 'dev-data.json');
  let current: Record<string, unknown> = {};
  try { current = JSON.parse(readFileSync(path, 'utf-8')); } catch { /* no file yet */ }
  writeFileSync(path, JSON.stringify({ ...current, ...body }, null, 2));
}

// ----- API -----
export async function GET(req: Request) {
  logAccess({ ts: new Date().toISOString(), type: 'family', page: '/family', ip: getIp(req), ua: getUa(req), device_id: getDeviceId(req) });
  const data = await readData();
  if (!data) {
    return NextResponse.json({
      liftingRecords: INITIAL_LIFTING_RECORDS,
      practiceNotes:  INITIAL_PRACTICE_NOTES,
      bodyRecords:    INITIAL_BODY_RECORDS,
      trainingMenu:   INITIAL_TRAINING_MENU,
      trainingLogs:   [],
      childBirthDate: '',
    });
  }
  return NextResponse.json({
    liftingRecords:    data.liftingRecords    ?? INITIAL_LIFTING_RECORDS,
    practiceNotes:     data.practiceNotes     ?? INITIAL_PRACTICE_NOTES,
    bodyRecords:       data.bodyRecords       ?? INITIAL_BODY_RECORDS,
    trainingMenu:      data.trainingMenu      ?? INITIAL_TRAINING_MENU,
    trainingLogs:      data.trainingLogs      ?? [],
    childBirthDate:    (data as any).childBirthDate ?? '',
    performanceRecords: (data as any).performanceRecords ?? [],
    customMetrics:      (data as any).customMetrics ?? [],
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as Record<string, unknown>;
    await writePartial(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
