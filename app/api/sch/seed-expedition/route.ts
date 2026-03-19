/**
 * 一時エンドポイント: 山梨合同遠征のお知らせを投稿する
 * 使用後は削除すること
 */
import { NextResponse } from 'next/server';
import type { SchAnnouncement } from '@/lib/types';

async function getRedis() {
  const { Redis } = await import('@upstash/redis');
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

const ANNOUNCEMENT: SchAnnouncement = {
  id: 'seed-yamanashi-2026-0328',
  date: '2026/03/28',
  title: '🏕️ 山梨合同遠征スケジュール（3/28〜3/30）',
  important: true,
  content: `【3/28（土）】
8:00  ゆめが丘第三公園・集合（集合時間は別途参照）
9:00  出発
12:00 到着
13:00 昼食
14:00〜16:00 トレーニング（合同）
18:00 洗濯・夕食・風呂
20:00 ミーティング
21:00 就寝

【3/29（日）】
6:30  起床・散歩
7:00  朝食
8:00  グラウンド移動・準備
10:00 トレーニング
12:00 昼食
13:00〜16:00 トレーニングマッチ（試合詳細はピクロ参照）
18:00 洗濯・夕食・風呂
20:00 ミーティング
21:00 就寝

【3/30（月）】
6:30  起床・散歩
7:00  朝食
8:00  グラウンド移動・準備
10:00 トレーニング（紅白戦等）
12:00 昼食
14:00 現地出発
16:00 ゆめが丘第三公園・到着・解散`,
  checkItems: [
    { text: 'ユニフォーム一式' },
    { text: 'サッカー用具一式', note: '水筒含む' },
    { text: 'バスタオル・洗濯ネット' },
    { text: '着替え必要分', note: '館内着含む' },
    { text: '常備薬', note: '必要に応じて' },
    { text: 'ハンガー', note: '洗濯用' },
    { text: '歯磨きセット' },
    { text: '筆記用具' },
    { text: '1日目昼食', note: '※持てられる容器でお願いします' },
  ],
};

export async function GET() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 500 });
  }

  const redis = await getRedis();
  const existing = await redis.get<SchAnnouncement[]>('sch:announcements') ?? [];

  // 既に同じIDがあればスキップ
  if (existing.some(a => a.id === ANNOUNCEMENT.id)) {
    return NextResponse.json({ ok: true, message: '既に投稿済みです', skipped: true });
  }

  const updated = [ANNOUNCEMENT, ...existing].sort((a, b) => b.date.localeCompare(a.date));
  await redis.set('sch:announcements', updated);

  return NextResponse.json({ ok: true, message: '投稿しました', total: updated.length });
}
