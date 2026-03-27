'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  SchEvent, SchEventType, SchMatchType, SchMatchFormat, SchScorer, SchMatch,
  SchAnnouncement, SchMember, SchMemberParent, SchParkingRecord, SchParkingSlot, SchNearbyParking,
  SchUpdateHistory,
} from '@/lib/types';

// ---- Utilities ----
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}
// 終了時間＋1時間が経過していたら「過去」とみなす
function isEventPast(event: { date: string; endDate?: string; endTime?: string }): boolean {
  const today = todayStr();
  const endDate = event.endDate ?? event.date;
  if (endDate < today) return true;
  if (endDate === today && event.endTime) {
    const [h, m] = event.endTime.split(':').map(Number);
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes() >= h * 60 + m + 60;
  }
  return false;
}
const DAYS = ['日', '月', '火', '水', '木', '金', '土'];
function dayLabel(dateStr: string) {
  return DAYS[new Date(dateStr.replace(/\//g, '-')).getDay()];
}
function toInputDate(s: string) { return s.split('/').join('-'); }
function fromInputDate(s: string) { return s.split('-').join('/'); }
function relativeDayLabel(dateStr: string, today: string): { label: string; color: string } {
  const diff = Math.round((new Date(dateStr.replace(/\//g, '-')).getTime() - new Date(today.replace(/\//g, '-')).getTime()) / 86400000);
  if (diff === 0) return { label: '今日',        color: 'text-yellow-300' };
  if (diff === 1) return { label: '明日',        color: 'text-green-300'  };
  if (diff === 2) return { label: '明後日',      color: 'text-emerald-300' };
  if (diff <= 6)  return { label: `${diff}日後`, color: 'text-slate-300'  };
  if (diff === 7) return { label: '一週間後',    color: 'text-slate-300'  };
  return { label: '一週間以上後', color: 'text-slate-400' };
}

function isInstagramUrl(url: string): boolean {
  return /instagram\.com\/(p|reel|tv)\/[^/]+/.test(url);
}

// ---- Event type config ----
type TypeCfg = { label: string; icon: string; badge: string; border: string; bg: string };
const TYPE_CFG: Record<string, TypeCfg> = {
  practice:   { label: '練習',   icon: '⚽', badge: 'bg-green-600/40 text-green-300',  border: 'border-green-500/30',  bg: 'bg-green-900/20'  },
  schedule:   { label: '練習',   icon: '⚽', badge: 'bg-green-600/40 text-green-300',  border: 'border-green-500/30',  bg: 'bg-green-900/20'  },
  match:      { label: '試合',   icon: '🏆', badge: 'bg-red-600/40 text-red-300',      border: 'border-red-500/30',    bg: 'bg-red-900/20'    },
  camp:       { label: '合宿/遠征', icon: '🏕️', badge: 'bg-amber-600/40 text-amber-300', border: 'border-amber-500/30', bg: 'bg-amber-900/20' },
  expedition: { label: '合宿/遠征', icon: '🏕️', badge: 'bg-amber-600/40 text-amber-300', border: 'border-amber-500/30', bg: 'bg-amber-900/20' },
  other:      { label: 'その他', icon: '📌', badge: 'bg-slate-600/40 text-slate-300',  border: 'border-slate-500/30',  bg: 'bg-slate-800/40'  },
};
function tc(type: string): TypeCfg { return TYPE_CFG[type] ?? TYPE_CFG.other; }
// 気象庁天気コード: 100台=晴, 200台=曇, 300台=雨, 400台=雪/みぞれ
function weatherEmoji(code: number): string {
  if (code >= 400) return '🌨️';
  if (code >= 300) return '🌧️';
  if (code >= 200) return '⛅';
  return '☀️';
}
function weatherLabel(code: number): string {
  if (code >= 400) return '雪';
  if (code >= 300) return '雨';
  if (code >= 200) return '曇り';
  return '晴れ';
}
// Calendar dot colors per event type
const EVENT_DOT: Record<string, string> = {
  practice: 'bg-green-400', schedule: 'bg-green-400',
  match: 'bg-red-400',
  camp: 'bg-amber-400', expedition: 'bg-amber-400',
  other: 'bg-slate-400',
};

const MATCH_TYPES: SchMatchType[] = ['公式戦', 'CUP戦', 'トレマ', 'その他'];
const MATCH_FORMATS: { value: SchMatchFormat; label: string }[] = [
  { value: 'friendly',          label: 'フレンドリー' },
  { value: 'tournament',        label: 'トーナメント' },
  { value: 'league_tournament', label: '予選+決勝T' },
];
const DEFAULT_MAX_SLOTS = 4;

// ---- Match helpers ----
/** レガシー単一試合 or 新形式複数試合を統一して返す */
function getMatches(event: SchEvent): SchMatch[] {
  if (event.matches && event.matches.length > 0) return event.matches;
  if (event.type === 'match') {
    return [{
      id: event.id + '_0',
      opponentName: event.opponentName,
      roundName: event.roundName,
      isHome: event.isHome,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
      halfTimeHomeScore: event.halfTimeHomeScore,
      halfTimeAwayScore: event.halfTimeAwayScore,
      hasExtraTime: event.hasExtraTime,
      extraTimeHomeScore: event.extraTimeHomeScore,
      extraTimeAwayScore: event.extraTimeAwayScore,
      hasPK: event.hasPK,
      pkHomeScore: event.pkHomeScore,
      pkAwayScore: event.pkAwayScore,
      scorers: event.scorers,
      assists: event.assists,
      memo: event.memo,
    }];
  }
  return [];
}

// Form-local state for one match entry
type MatchFormState = {
  id: string;
  opponentName: string;
  roundName: string;
  dayNumber: string;
  isHome: boolean;
  homeScore: string;
  awayScore: string;
  htHome: string; htAway: string;
  hasExtraTime: boolean;
  etHome: string; etAway: string;
  hasPK: boolean;
  pkHome: string; pkAway: string;
  scorers: SchScorer[];
  assists: SchScorer[];
  memo: string;
  videoUrl: string;
};
function emptyMatchState(): MatchFormState {
  return { id: generateId(), opponentName: '', roundName: '', dayNumber: '1', isHome: true, homeScore: '', awayScore: '', htHome: '', htAway: '', hasExtraTime: false, etHome: '', etAway: '', hasPK: false, pkHome: '', pkAway: '', scorers: [], assists: [], memo: '', videoUrl: '' };
}
function matchToFormState(m: SchMatch): MatchFormState {
  return {
    id: m.id,
    opponentName: m.opponentName ?? '',
    roundName: m.roundName ?? '',
    dayNumber: m.dayNumber != null ? String(m.dayNumber) : '1',
    isHome: m.isHome ?? true,
    homeScore: m.homeScore != null ? String(m.homeScore) : '',
    awayScore: m.awayScore != null ? String(m.awayScore) : '',
    htHome: m.halfTimeHomeScore != null ? String(m.halfTimeHomeScore) : '',
    htAway: m.halfTimeAwayScore != null ? String(m.halfTimeAwayScore) : '',
    hasExtraTime: m.hasExtraTime ?? false,
    etHome: m.extraTimeHomeScore != null ? String(m.extraTimeHomeScore) : '',
    etAway: m.extraTimeAwayScore != null ? String(m.extraTimeAwayScore) : '',
    hasPK: m.hasPK ?? false,
    pkHome: m.pkHomeScore != null ? String(m.pkHomeScore) : '',
    pkAway: m.pkAwayScore != null ? String(m.pkAwayScore) : '',
    scorers: m.scorers ?? [],
    assists: m.assists ?? [],
    memo: m.memo ?? '',
    videoUrl: m.videoUrl ?? '',
  };
}
function formStateToMatch(s: MatchFormState): SchMatch {
  return {
    id: s.id,
    opponentName: s.opponentName || undefined,
    roundName: s.roundName || undefined,
    dayNumber: s.dayNumber && s.dayNumber !== '1' ? Number(s.dayNumber) : undefined,
    isHome: s.isHome,
    homeScore: s.homeScore !== '' ? Number(s.homeScore) : undefined,
    awayScore: s.awayScore !== '' ? Number(s.awayScore) : undefined,
    halfTimeHomeScore: s.htHome !== '' ? Number(s.htHome) : undefined,
    halfTimeAwayScore: s.htAway !== '' ? Number(s.htAway) : undefined,
    hasExtraTime: s.hasExtraTime || undefined,
    extraTimeHomeScore: s.hasExtraTime && s.etHome !== '' ? Number(s.etHome) : undefined,
    extraTimeAwayScore: s.hasExtraTime && s.etAway !== '' ? Number(s.etAway) : undefined,
    hasPK: s.hasPK || undefined,
    pkHomeScore: s.hasPK && s.pkHome !== '' ? Number(s.pkHome) : undefined,
    pkAwayScore: s.hasPK && s.pkAway !== '' ? Number(s.pkAway) : undefined,
    scorers: s.scorers.length > 0 ? s.scorers : undefined,
    assists: s.assists.length > 0 ? s.assists : undefined,
    memo: s.memo || undefined,
    videoUrl: s.videoUrl || undefined,
  };
}

// ---- MatchEntry (1試合分の入力フォーム) ----
function MatchEntry({
  value, onChange, onRemove, members, index, isMultiDay, dayCount,
}: {
  value: MatchFormState;
  onChange: (updated: MatchFormState) => void;
  onRemove?: () => void;
  members: SchMember[];
  index: number;
  isMultiDay: boolean;
  dayCount: number;
}) {
  const [scorerMid, setScorerMid] = useState('');
  const [scorerCnt, setScorerCnt] = useState(1);
  const [assistMid, setAssistMid] = useState('');
  const [assistCnt, setAssistCnt] = useState(1);
  const sortedMembers = useMemo(() => [...members].sort((a, b) => a.number - b.number), [members]);
  const upd = (partial: Partial<MatchFormState>) => onChange({ ...value, ...partial });

  const addScorer = () => {
    if (!scorerMid) return;
    const existing = value.scorers.find(s => s.memberId === scorerMid);
    upd({ scorers: existing ? value.scorers.map(s => s.memberId === scorerMid ? { ...s, count: s.count + scorerCnt } : s) : [...value.scorers, { memberId: scorerMid, count: scorerCnt }] });
    setScorerMid(''); setScorerCnt(1);
  };
  const addAssist = () => {
    if (!assistMid) return;
    const existing = value.assists.find(s => s.memberId === assistMid);
    upd({ assists: existing ? value.assists.map(s => s.memberId === assistMid ? { ...s, count: s.count + assistCnt } : s) : [...value.assists, { memberId: assistMid, count: assistCnt }] });
    setAssistMid(''); setAssistCnt(1);
  };

  const inputCls = 'w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none placeholder-slate-500';
  const labelCls = 'block text-xs font-semibold text-slate-400 mb-1';
  const hasDetail = !!(value.scorers.length || value.assists.length || value.hasPK || value.hasExtraTime || value.htHome || value.htAway || value.memo || value.videoUrl);

  return (
    <div className="border border-slate-600/50 rounded-xl p-3 space-y-3 bg-slate-800/30">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-red-300">試合 {index + 1}</p>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-xs text-slate-500 hover:text-red-400 px-2 py-0.5 rounded hover:bg-slate-700">× 削除</button>
        )}
      </div>

      {/* 相手チーム */}
      <div><label className={labelCls}>🆚 相手チーム</label><input type="text" value={value.opponentName} onChange={e => upd({ opponentName: e.target.value })} placeholder="例: ○○FC" className={inputCls} /></div>

      {/* ラウンド名 */}
      <div><label className={labelCls}>試合名・ラウンド</label><input type="text" value={value.roundName} onChange={e => upd({ roundName: e.target.value })} placeholder="例: 予選A / 第2試合 / 準決勝" className={inputCls} /></div>

      {/* 何日目 (複数日のときのみ) */}
      {isMultiDay && dayCount > 1 && (
        <div>
          <label className={labelCls}>何日目？</label>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: dayCount }, (_, i) => String(i + 1)).map(d => (
              <button key={d} type="button" onClick={() => upd({ dayNumber: d })}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${value.dayNumber === d ? 'bg-blue-600/40 text-blue-300 border-transparent' : 'text-slate-400 border-slate-600'}`}>
                {d}日目
              </button>
            ))}
          </div>
        </div>
      )}

      {/* スコア */}
      <div>
        <label className={labelCls}>最終スコア（SCH − 相手）</label>
        <div className="flex items-center gap-3">
          <input type="number" min="0" value={value.homeScore} onChange={e => upd({ homeScore: e.target.value })} placeholder="-" className="w-16 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-2 text-lg font-bold text-center focus:border-red-400 focus:outline-none" />
          <span className="text-slate-400 font-bold text-lg">−</span>
          <input type="number" min="0" value={value.awayScore} onChange={e => upd({ awayScore: e.target.value })} placeholder="-" className="w-16 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-2 text-lg font-bold text-center focus:border-red-400 focus:outline-none" />
        </div>
      </div>

      {/* 詳細 */}
      <details className="group" open={hasDetail}>
        <summary className="text-xs text-slate-400 cursor-pointer select-none hover:text-slate-200 flex items-center gap-1 py-1">
          <span className="group-open:rotate-90 inline-block transition-transform">▶</span> 詳細（前半/延長/PK/得点者/動画URL）
        </summary>
        <div className="space-y-3 mt-3 pl-1">

          {/* ホーム/アウェー */}
          <div className="flex gap-2 items-center">
            <span className="text-xs text-slate-400 font-semibold">ホーム/アウェー:</span>
            <button type="button" onClick={() => upd({ isHome: true })} className={`px-3 py-1 rounded-lg text-xs font-bold ${value.isHome ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>ホーム</button>
            <button type="button" onClick={() => upd({ isHome: false })} className={`px-3 py-1 rounded-lg text-xs font-bold ${!value.isHome ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400'}`}>アウェー</button>
          </div>

          {/* 前半スコア */}
          <div>
            <label className={labelCls}>前半スコア</label>
            <div className="flex items-center gap-2">
              <input type="number" min="0" value={value.htHome} onChange={e => upd({ htHome: e.target.value })} placeholder="-" className="w-16 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-1.5 text-sm text-center focus:border-red-400 focus:outline-none" />
              <span className="text-slate-400 font-bold">−</span>
              <input type="number" min="0" value={value.htAway} onChange={e => upd({ htAway: e.target.value })} placeholder="-" className="w-16 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-1.5 text-sm text-center focus:border-red-400 focus:outline-none" />
            </div>
          </div>

          {/* 延長 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={value.hasExtraTime} onChange={e => upd({ hasExtraTime: e.target.checked })} className="w-4 h-4 accent-orange-500" />
            <span className="text-sm text-slate-300">延長戦あり</span>
          </label>
          {value.hasExtraTime && (
            <div className="flex items-center gap-2 pl-6">
              <span className="text-xs text-slate-400 w-10">延長</span>
              <input type="number" min="0" value={value.etHome} onChange={e => upd({ etHome: e.target.value })} placeholder="-" className="w-16 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-1.5 text-sm text-center focus:outline-none" />
              <span className="text-slate-400 font-bold">−</span>
              <input type="number" min="0" value={value.etAway} onChange={e => upd({ etAway: e.target.value })} placeholder="-" className="w-16 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-1.5 text-sm text-center focus:outline-none" />
            </div>
          )}

          {/* PK */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={value.hasPK} onChange={e => upd({ hasPK: e.target.checked })} className="w-4 h-4 accent-yellow-500" />
            <span className="text-sm text-slate-300">PKあり</span>
          </label>
          {value.hasPK && (
            <div className="flex items-center gap-2 pl-6">
              <span className="text-xs text-slate-400 w-10">PK</span>
              <input type="number" min="0" value={value.pkHome} onChange={e => upd({ pkHome: e.target.value })} placeholder="-" className="w-16 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-1.5 text-sm text-center focus:outline-none" />
              <span className="text-slate-400 font-bold">−</span>
              <input type="number" min="0" value={value.pkAway} onChange={e => upd({ pkAway: e.target.value })} placeholder="-" className="w-16 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-1.5 text-sm text-center focus:outline-none" />
            </div>
          )}

          {/* 得点者 */}
          {sortedMembers.length > 0 && (
            <div>
              <label className={labelCls}>⚽ 得点者</label>
              <div className="flex gap-2 mb-2">
                <select value={scorerMid} onChange={e => setScorerMid(e.target.value)} className="flex-1 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400">
                  <option value="">選手を選択</option>
                  {sortedMembers.map(m => <option key={m.id} value={m.id}>#{m.number} {m.name}</option>)}
                </select>
                <input type="number" min="1" max="9" value={scorerCnt} onChange={e => setScorerCnt(Number(e.target.value))} className="w-14 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-1.5 text-xs text-center focus:outline-none" />
                <button type="button" onClick={addScorer} className="bg-blue-600/40 text-blue-300 text-xs px-3 py-1.5 rounded-lg border border-blue-500/40 hover:bg-blue-600/60">追加</button>
              </div>
              {value.scorers.length > 0 && (
                <div className="space-y-1">
                  {value.scorers.map(s => {
                    const m = sortedMembers.find(x => x.id === s.memberId);
                    return (
                      <div key={s.memberId} className="flex items-center gap-2 bg-slate-700/40 rounded-lg px-3 py-1.5">
                        <span className="text-xs text-white flex-1">#{m?.number} {m?.name} × {s.count}</span>
                        <button type="button" onClick={() => upd({ scorers: value.scorers.filter(x => x.memberId !== s.memberId) })} className="text-slate-400 hover:text-red-400 text-xs">削除</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* アシスト */}
          {sortedMembers.length > 0 && (
            <div>
              <label className={labelCls}>🎯 アシスト</label>
              <div className="flex gap-2 mb-2">
                <select value={assistMid} onChange={e => setAssistMid(e.target.value)} className="flex-1 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400">
                  <option value="">選手を選択</option>
                  {sortedMembers.map(m => <option key={m.id} value={m.id}>#{m.number} {m.name}</option>)}
                </select>
                <input type="number" min="1" max="9" value={assistCnt} onChange={e => setAssistCnt(Number(e.target.value))} className="w-14 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-1.5 text-xs text-center focus:outline-none" />
                <button type="button" onClick={addAssist} className="bg-blue-600/40 text-blue-300 text-xs px-3 py-1.5 rounded-lg border border-blue-500/40 hover:bg-blue-600/60">追加</button>
              </div>
              {value.assists.length > 0 && (
                <div className="space-y-1">
                  {value.assists.map(s => {
                    const m = sortedMembers.find(x => x.id === s.memberId);
                    return (
                      <div key={s.memberId} className="flex items-center gap-2 bg-slate-700/40 rounded-lg px-3 py-1.5">
                        <span className="text-xs text-white flex-1">#{m?.number} {m?.name} × {s.count}</span>
                        <button type="button" onClick={() => upd({ assists: value.assists.filter(x => x.memberId !== s.memberId) })} className="text-slate-400 hover:text-red-400 text-xs">削除</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* メモ */}
          <div><label className={labelCls}>💬 一言メモ</label><input type="text" value={value.memo} onChange={e => upd({ memo: e.target.value })} placeholder="試合の感想・特記事項" className={inputCls} /></div>

          {/* 動画URL */}
          <div><label className={labelCls}>🎬 動画URL（BAND / YouTube など）</label><input type="url" value={value.videoUrl} onChange={e => upd({ videoUrl: e.target.value })} placeholder="https://..." className={inputCls} /></div>
        </div>
      </details>
    </div>
  );
}

// ---- Parking Logic ----
type EventItem = { id: string; date: string; endDate?: string; endTime?: string; type: string; label: string; maxSlots: number };
type EventPlan = EventItem & { slots: SchParkingSlot[]; rotationStartIndex: number; consumedCount: number };

function computeEventParking(
  sortedMembers: SchMember[],
  rotationIndex: number,
  skippedMemberIds: string[],
  maxSlots: number,
): { slots: SchParkingSlot[]; consumedCount: number } {
  const n = sortedMembers.length;
  if (n === 0) return { slots: [], consumedCount: 0 };
  // maxSlots === -1 means unlimited: all members can park, no rotation consumed
  if (maxSlots === -1) {
    const slots: SchParkingSlot[] = sortedMembers.map(m => ({ memberId: m.id, status: 'used' as const }));
    return { slots, consumedCount: 0 };
  }
  const skipped = new Set(skippedMemberIds);
  const slots: SchParkingSlot[] = [];
  let offset = 0;
  let filled = 0;
  while (filled < maxSlots && offset < n) {
    const member = sortedMembers[(rotationIndex + offset) % n];
    offset++;
    if (skipped.has(member.id)) {
      slots.push({ memberId: member.id, status: 'skipped' });
    } else {
      slots.push({ memberId: member.id, status: 'used', isFillIn: offset > maxSlots });
      filled++;
    }
  }
  return { slots, consumedCount: offset };
}

function buildParkingPlan(
  sortedMembers: SchMember[],
  events: EventItem[],
  rotationIndex: number,
  records: SchParkingRecord[]
): EventPlan[] {
  let ri = rotationIndex % Math.max(sortedMembers.length, 1);
  return events.map(event => {
    const record = records.find(r => r.eventId === event.id);
    const skippedIds = record?.slots.filter(s => s.status === 'skipped').map(s => s.memberId) ?? [];
    const { slots, consumedCount } = computeEventParking(sortedMembers, ri, skippedIds, event.maxSlots);
    const mergedSlots = slots.map(slot => {
      const persisted = record?.slots.find(s => s.memberId === slot.memberId);
      return persisted ? { ...slot, ...persisted } : slot;
    });
    const startRi = ri;
    // unlimited events don't advance the rotation
    if (event.maxSlots !== -1) {
      ri = (ri + consumedCount) % Math.max(sortedMembers.length, 1);
    }
    return { ...event, slots: mergedSlots, rotationStartIndex: startRi, consumedCount };
  });
}

// ---- ParkingEventCard ----
function ParkingEventCard({
  plan, members, onSkip, onUnskip, onMarkUsed, onUpdateMaxSlots,
}: {
  plan: EventPlan;
  members: SchMember[];
  onSkip: (eventId: string, memberId: string, comment: string) => void;
  onUnskip: (eventId: string, memberId: string) => void;
  onMarkUsed: (eventId: string, memberId: string) => void;
  onUpdateMaxSlots: (eventId: string, maxSlots: number) => void;
}) {
  const [skipTarget, setSkipTarget] = useState<string | null>(null);
  const [skipComment, setSkipComment] = useState('');
  const [editingSlots, setEditingSlots] = useState(false);
  const [slotsInput, setSlotsInput] = useState(String(plan.maxSlots));
  const getMember = (id: string) => members.find(m => m.id === id);
  const isPast = isEventPast(plan);
  const activeSlots = plan.slots.filter(s => s.status !== 'skipped');
  const skippedSlots = plan.slots.filter(s => s.status === 'skipped');
  const cfg = tc(plan.type);

  return (
    <div className={`rounded-xl overflow-hidden border ${isPast ? 'opacity-60 border-white/5' : cfg.border}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 px-4 py-2 ${cfg.bg}`}>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
          {cfg.icon} {cfg.label}
        </span>
        <span className="text-sm font-semibold text-white">{plan.date.slice(5).replace('/', '/')}</span>
        <span className="text-xs text-slate-400">({dayLabel(plan.date)})</span>
        <span className="text-xs text-slate-400 truncate flex-1">{plan.label}</span>
        {editingSlots ? (
          <div className="flex items-center gap-1">
            <input
              type="number" min="1" max="20" value={slotsInput}
              onChange={e => setSlotsInput(e.target.value)}
              className="w-12 text-xs bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-white text-center focus:outline-none focus:border-blue-400"
            />
            <span className="text-[10px] text-slate-400">台</span>
            <button
              onClick={() => { onUpdateMaxSlots(plan.id, Math.max(1, Number(slotsInput) || DEFAULT_MAX_SLOTS)); setEditingSlots(false); }}
              className="text-[10px] text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/40"
            >保存</button>
            <button onClick={() => { setEditingSlots(false); setSlotsInput(String(plan.maxSlots)); }} className="text-[10px] text-slate-400">✕</button>
          </div>
        ) : plan.maxSlots === 0 ? (
          <span className="text-[10px] text-red-400/70 whitespace-nowrap">🚫 駐車場なし</span>
        ) : plan.maxSlots === -1 ? (
          <span className="text-[10px] text-emerald-400/80 whitespace-nowrap">🅿️ 制限なし</span>
        ) : (
          <button onClick={() => { setEditingSlots(true); setSlotsInput(String(plan.maxSlots)); }} className="text-[10px] text-slate-500 hover:text-slate-300 whitespace-nowrap">
            🅿️ {plan.maxSlots}台
          </button>
        )}
      </div>

      {/* Active slots */}
      {plan.maxSlots > 0 && <div className="bg-slate-800/60">
        {activeSlots.map((slot, i) => {
          const member = getMember(slot.memberId);
          if (!member) return null;
          return (
            <div key={slot.memberId} className={`flex items-center gap-2 px-3 py-1 ${i < activeSlots.length - 1 ? 'border-b border-white/5' : ''}`}>
              <span className="text-slate-500 text-[10px] w-3 text-right">{i + 1}</span>
              <span className="w-7 text-center text-[10px] font-bold text-blue-300 bg-blue-900/30 rounded py-0.5">#{member.number}</span>
              <span className="text-white text-xs flex-1">{member.nameKana || member.name}</span>
              {(slot.status === 'used' || slot.status === 'pending') && !isPast && (
                <div className="flex items-center gap-1">
                  {slot.status === 'used'
                    ? <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1 py-0.5 rounded-full">使用予定</span>
                    : <span className="text-[9px] text-slate-500">─</span>
                  }
                  {slot.status === 'pending' && (
                    <button onClick={() => onMarkUsed(plan.id, slot.memberId)} className="text-[9px] text-slate-500 hover:text-green-400 px-1.5 py-0.5 rounded border border-slate-700 hover:border-green-500/50 transition-colors">使用</button>
                  )}
                  <button onClick={() => setSkipTarget(slot.memberId)} className="text-[9px] text-slate-500 hover:text-amber-400 px-1.5 py-0.5 rounded border border-slate-700 hover:border-amber-500/50 transition-colors">スキップ</button>
                </div>
              )}
              {(slot.status === 'used' || slot.status === 'pending') && isPast && (
                <span className={`text-[9px] px-1 py-0.5 rounded-full ${slot.status === 'used' ? 'bg-green-500/20 text-green-300' : 'text-slate-500'}`}>
                  {slot.status === 'used' ? '✓' : '─'}
                </span>
              )}
            </div>
          );
        })}
      </div>}

      {/* Skipped */}
      {plan.maxSlots > 0 && skippedSlots.length > 0 && (
        <div className="bg-slate-800/30 border-t border-white/5 px-3 py-1.5 space-y-0.5">
          {skippedSlots.map(slot => {
            const member = getMember(slot.memberId);
            return (
              <div key={slot.memberId} className="flex items-center gap-2 text-[10px]">
                <span className="text-slate-500 line-through">#{member?.number} {member?.nameKana || member?.name}</span>
                {slot.skipComment && <span className="text-slate-500 italic">「{slot.skipComment}」</span>}
                {!isPast && (
                  <button onClick={() => onUnskip(plan.id, slot.memberId)} className="ml-auto text-slate-400 hover:text-white text-[9px] px-1.5 py-0.5 rounded border border-slate-600 hover:border-slate-400 transition-colors">取消</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Skip input */}
      {skipTarget && (
        <div className="border-t border-amber-500/30 bg-amber-900/10 px-4 py-3">
          <p className="text-xs text-amber-300 mb-2">スキップコメント（空欄可）</p>
          <div className="flex gap-2">
            <input
              type="text" value={skipComment} onChange={e => setSkipComment(e.target.value)}
              placeholder="自分の番はいらない"
              className="flex-1 rounded-lg border border-slate-600 bg-slate-900 text-white px-3 py-1.5 text-xs focus:border-amber-400 focus:outline-none placeholder-slate-600"
              autoFocus
            />
            <button
              onClick={() => { onSkip(plan.id, skipTarget, skipComment || '自分の番はいらない'); setSkipTarget(null); setSkipComment(''); }}
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-3 py-1.5 rounded-lg"
            >確定</button>
            <button onClick={() => { setSkipTarget(null); setSkipComment(''); }} className="text-slate-400 text-xs px-2">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- EventForm ----
function EventForm({
  initialEvent,
  initialDate,
  members,
  onSave,
  onClose,
}: {
  initialEvent?: SchEvent;
  initialDate?: string;
  members: SchMember[];
  onSave: (event: SchEvent) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<SchEventType>(initialEvent?.type ?? 'practice');
  const [date, setDate] = useState(initialEvent?.date ?? initialDate ?? todayStr());
  const [endDate, setEndDate] = useState(initialEvent?.endDate ?? '');
  const [startTime, setStartTime] = useState(initialEvent?.startTime ?? '');
  const [endTime, setEndTime] = useState(initialEvent?.endTime ?? '');
  const [location, setLocation] = useState(initialEvent?.location ?? '');
  const [label, setLabel] = useState(initialEvent?.label ?? '');
  const [note, setNote] = useState(initialEvent?.note ?? '');
  const initialParking = initialEvent?.maxParkingSlots ?? DEFAULT_MAX_SLOTS;
  const [parkingAvailable, setParkingAvailable] = useState(initialParking !== 0);
  const [parkingUnlimited, setParkingUnlimited] = useState(initialParking === -1);
  const [maxParkingSlots, setMaxParkingSlots] = useState(initialParking > 0 ? initialParking : DEFAULT_MAX_SLOTS);

  // Match fields
  const [matchType, setMatchType] = useState<SchMatchType>(initialEvent?.matchType ?? 'トレマ');
  const [matchFormat, setMatchFormat] = useState<SchMatchFormat>(initialEvent?.matchFormat ?? 'friendly');
  const [matches, setMatches] = useState<MatchFormState[]>(() => {
    if (initialEvent?.type === 'match') {
      const ms = getMatches(initialEvent);
      return ms.length > 0 ? ms.map(matchToFormState) : [emptyMatchState()];
    }
    return [emptyMatchState()];
  });

  // Camp/expedition
  const [mapQuery, setMapQuery] = useState(initialEvent?.mapQuery ?? '');

  // Meeting info (match + camp)
  const [meetingTime, setMeetingTime] = useState(initialEvent?.meetingTime ?? '');
  const [meetingPlace, setMeetingPlace] = useState(initialEvent?.meetingPlace ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const base: SchEvent = {
      id: initialEvent?.id ?? generateId(),
      date, type,
      endDate: (type === 'match' || type === 'camp') && endDate ? endDate : undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      location: location || undefined,
      label: label || undefined,
      note: note || undefined,
      meetingTime: (type === 'match' || type === 'camp' || type === 'other') && meetingTime ? meetingTime : undefined,
      meetingPlace: (type === 'match' || type === 'camp' || type === 'other') && meetingPlace ? meetingPlace : undefined,
      maxParkingSlots: parkingAvailable ? (parkingUnlimited ? -1 : (maxParkingSlots !== DEFAULT_MAX_SLOTS ? maxParkingSlots : undefined)) : 0,
    };
    if (type === 'match') {
      Object.assign(base, {
        matchType, matchFormat,
        matches: matches.map(formStateToMatch),
      });
    }
    if (type === 'camp' || type === 'expedition') {
      Object.assign(base, { mapQuery: mapQuery || undefined });
    }
    onSave(base);
    onClose();
  };

  const inputCls = 'w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none placeholder-slate-500';
  const labelCls = 'block text-xs font-semibold text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg border border-white/10 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">{initialEvent ? '予定を編集' : '予定を追加'}</h3>
            <button onClick={onClose} className="text-slate-400 text-2xl leading-none">&times;</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type selector */}
            <div>
              <label className={labelCls}>種別</label>
              <div className="flex flex-wrap gap-1.5">
                {(['practice','match','camp','other'] as SchEventType[]).map(t => (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors ${type === t ? `${tc(t).badge} border-transparent` : 'text-slate-400 border-slate-600 hover:border-slate-500'}`}>
                    {tc(t).icon} {tc(t).label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date & Time */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={labelCls}>📅 開始日</label>
                <input type="date" value={toInputDate(date)} onChange={e => setDate(fromInputDate(e.target.value))} required className={inputCls} />
              </div>
              {(type === 'match' || type === 'camp') && (
                <div className="flex-1">
                  <label className={labelCls}>📅 終了日（複数日）</label>
                  <input type="date" value={endDate ? toInputDate(endDate) : ''} onChange={e => setEndDate(e.target.value ? fromInputDate(e.target.value) : '')} className={inputCls} />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <div className="flex-1"><label className={labelCls}>⏰ 開始</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputCls} /></div>
              <div className="flex-1"><label className={labelCls}>⏰ 終了</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputCls} /></div>
            </div>

            {/* Location & Label */}
            <div><label className={labelCls}>📍 場所</label><input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="例: ○○グラウンド" className={inputCls} /></div>
            <div><label className={labelCls}>📋 イベント名{type === 'match' ? '・大会名' : ''}</label><input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder={type === 'match' ? '例: 神奈川カップ2026' : '例: 通常練習'} className={inputCls} /></div>
            <div><label className={labelCls}>📝 メモ</label><input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="持ち物・備考など" className={inputCls} /></div>

            {/* Meeting info (match / camp / other) */}
            {(type === 'match' || type === 'camp' || type === 'other') && (
              <div className="space-y-3 border-t border-white/10 pt-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">🚩 集合情報（任意）</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelCls} style={{marginBottom:0}}>⏰ 集合時間</label>
                      {startTime && (
                        <button type="button" onClick={() => setMeetingTime(startTime)}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors">
                          開始時間と同じ
                        </button>
                      )}
                    </div>
                    <input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} className={inputCls} />
                  </div>
                  <div className="flex-1">
                    <label className={labelCls}>📍 集合場所</label>
                    <input type="text" value={meetingPlace} onChange={e => setMeetingPlace(e.target.value)} placeholder="例: 正門前" className={inputCls} />
                  </div>
                </div>
              </div>
            )}

            {/* Parking */}
            <div>
              <label className={labelCls}>🅿️ 駐車場</label>
              <div className="flex gap-2 mb-2">
                <button type="button" onClick={() => setParkingAvailable(true)}
                  className={`flex-1 text-xs py-2 rounded-xl font-semibold border transition-colors ${parkingAvailable ? 'bg-blue-600/40 text-blue-200 border-blue-500/50' : 'text-slate-400 border-slate-600 hover:border-slate-500'}`}>
                  あり
                </button>
                <button type="button" onClick={() => setParkingAvailable(false)}
                  className={`flex-1 text-xs py-2 rounded-xl font-semibold border transition-colors ${!parkingAvailable ? 'bg-red-600/40 text-red-300 border-red-500/50' : 'text-slate-400 border-slate-600 hover:border-slate-500'}`}>
                  なし
                </button>
              </div>
              {parkingAvailable && (
                <>
                  <div className="flex gap-2 mb-2">
                    <button type="button" onClick={() => setParkingUnlimited(false)}
                      className={`flex-1 text-xs py-1.5 rounded-lg font-semibold border transition-colors ${!parkingUnlimited ? 'bg-amber-600/40 text-amber-200 border-amber-500/50' : 'text-slate-400 border-slate-600 hover:border-slate-500'}`}>
                      制限あり
                    </button>
                    <button type="button" onClick={() => setParkingUnlimited(true)}
                      className={`flex-1 text-xs py-1.5 rounded-lg font-semibold border transition-colors ${parkingUnlimited ? 'bg-emerald-600/40 text-emerald-200 border-emerald-500/50' : 'text-slate-400 border-slate-600 hover:border-slate-500'}`}>
                      制限なし
                    </button>
                  </div>
                  {!parkingUnlimited && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">何台？</span>
                      <input type="number" min="1" max="20" value={maxParkingSlots} onChange={e => setMaxParkingSlots(Number(e.target.value))} className="w-20 rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none text-center" />
                      <span className="text-xs text-slate-400">台</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Match-specific fields */}
            {type === 'match' && (
              <div className="space-y-3 border-t border-white/10 pt-4">
                <p className="text-xs font-bold text-red-400 uppercase tracking-wider">試合情報</p>

                {/* 試合区分 */}
                <div>
                  <label className={labelCls}>試合区分</label>
                  <div className="flex flex-wrap gap-1.5">
                    {MATCH_TYPES.map(mt => (
                      <button key={mt} type="button" onClick={() => setMatchType(mt)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${matchType === mt ? 'bg-red-600/40 text-red-300 border-transparent' : 'text-slate-400 border-slate-600'}`}>
                        {mt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 大会形式 */}
                <div>
                  <label className={labelCls}>大会形式</label>
                  <div className="flex flex-wrap gap-1.5">
                    {MATCH_FORMATS.map(mf => (
                      <button key={mf.value} type="button" onClick={() => setMatchFormat(mf.value)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${matchFormat === mf.value ? 'bg-orange-600/40 text-orange-300 border-transparent' : 'text-slate-400 border-slate-600'}`}>
                        {mf.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 各試合エントリ */}
                {matches.map((m, i) => {
                  const isMultiDay = !!(endDate && endDate !== date);
                  const dayCount = isMultiDay
                    ? Math.max(2, Math.round((new Date(endDate.replace(/\//g, '-')).getTime() - new Date(date.replace(/\//g, '-')).getTime()) / 86400000) + 1)
                    : 1;
                  return (
                    <MatchEntry
                      key={m.id}
                      value={m}
                      index={i}
                      onChange={updated => setMatches(prev => prev.map((x, j) => j === i ? updated : x))}
                      onRemove={matches.length > 1 ? () => setMatches(prev => prev.filter((_, j) => j !== i)) : undefined}
                      members={members}
                      isMultiDay={isMultiDay}
                      dayCount={dayCount}
                    />
                  );
                })}

                {/* 試合追加ボタン */}
                <button type="button" onClick={() => setMatches(prev => [...prev, emptyMatchState()])}
                  className="w-full text-xs py-2.5 rounded-xl border border-dashed border-slate-500 text-slate-400 hover:text-white hover:border-slate-400 transition-colors">
                  + 試合を追加
                </button>
              </div>
            )}

            {/* Camp/expedition map */}
            {(type === 'camp' || type === 'expedition') && (
              <div className="border-t border-white/10 pt-4">
                <label className={labelCls}>🗺️ 目的地（Google Maps 検索ワード）</label>
                <input type="text" value={mapQuery} onChange={e => setMapQuery(e.target.value)} placeholder="例: 静岡県 御殿場市" className={inputCls} />
              </div>
            )}

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-all">保存</button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ---- EventCard ----
function EventCard({
  event, members, onEdit, onDelete,
}: {
  event: SchEvent;
  members: SchMember[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPast = isEventPast(event);
  const cfg = tc(event.type);
  const getMember = (id: string) => members.find(m => m.id === id);

  // 複数試合対応
  const eventMatches = event.type === 'match' ? getMatches(event) : [];
  const scoredMatches = eventMatches.filter(m => m.homeScore != null && m.awayScore != null);
  const matchCount = eventMatches.length;
  // 全試合の勝敗サマリー
  const mW = scoredMatches.filter(m => m.homeScore! > m.awayScore!).length;
  const mD = scoredMatches.filter(m => m.homeScore! === m.awayScore!).length;
  const mL = scoredMatches.filter(m => m.homeScore! < m.awayScore!).length;
  // 単試合用
  const firstMatch = eventMatches[0];
  const hasScore = scoredMatches.length > 0;
  const isWin = mW > 0 && mD === 0 && mL === 0;
  const isLoss = mL > 0 && mW === 0 && mD === 0;

  return (
    <div className={`rounded-xl border overflow-hidden ${isPast ? 'opacity-70 border-white/5' : cfg.border}`}>
      <div className={`${isPast ? 'bg-slate-800/40' : cfg.bg} px-3 py-3`}>
        <div className="flex items-start gap-2">
          {/* Date badge */}
          <div className={`text-center px-2 py-1.5 rounded-lg flex-shrink-0 ${event.endDate ? 'min-w-[60px]' : 'min-w-[44px]'} ${isPast ? 'bg-slate-700 text-slate-400' : 'bg-black/20 text-white'}`}>
            {event.endDate
              ? <p className="text-[9px] leading-tight">{event.date.slice(5)}〜<br/>{event.endDate.slice(5)}</p>
              : <p className="text-[10px] leading-tight">{event.date.slice(5).replace('/', '/')}</p>
            }
            <p className="text-sm font-bold leading-tight">{dayLabel(event.date)}</p>
          </div>
          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
              {event.type === 'match' && event.matchType && (
                <span className="text-[10px] bg-slate-700/60 text-slate-300 px-1.5 py-0.5 rounded-full">{event.matchType}</span>
              )}
              {event.type === 'match' && event.matchFormat && event.matchFormat !== 'friendly' && (
                <span className="text-[10px] bg-slate-700/60 text-slate-300 px-1.5 py-0.5 rounded-full">
                  {MATCH_FORMATS.find(f => f.value === event.matchFormat)?.label}
                </span>
              )}
              {hasScore && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isWin ? 'bg-green-600/30 text-green-300' : isLoss ? 'bg-red-600/30 text-red-300' : 'bg-slate-600/30 text-slate-300'}`}>
                  {matchCount > 1 ? `${mW}勝${mD}分${mL}敗` : (isWin ? '勝' : isLoss ? '負' : '分')}
                </span>
              )}
            </div>
            {/* Title */}
            {event.type === 'match' ? (
              matchCount > 1 ? (
                <p className="text-sm font-semibold text-white mt-1 truncate">
                  {firstMatch?.opponentName ? `🆚 ${firstMatch.opponentName} ほか${matchCount - 1}試合` : `🏆 ${matchCount}試合`}
                </p>
              ) : (
                <p className="text-sm font-semibold text-white mt-1 truncate">
                  {firstMatch?.opponentName ? `🆚 ${firstMatch.opponentName}` : '相手未定'}
                </p>
              )
            ) : (
              <p className="text-sm font-semibold text-white mt-1 truncate">{event.label || event.location || '（タイトルなし）'}</p>
            )}
            {event.type === 'match' && event.label && <p className="text-xs text-slate-400 truncate">{event.label}</p>}
            {/* スコア表示 */}
            {event.type === 'match' && matchCount === 1 && firstMatch && firstMatch.homeScore != null && firstMatch.awayScore != null && (
              <p className="text-xl font-extrabold text-white leading-tight">{firstMatch.homeScore} <span className="text-slate-400 text-sm font-normal">−</span> {firstMatch.awayScore}</p>
            )}
            {event.type === 'match' && matchCount > 1 && scoredMatches.length > 0 && (
              <p className="text-xs text-slate-300 mt-0.5 truncate">
                {scoredMatches.map(m => `${m.homeScore}−${m.awayScore}`).join(' / ')}
              </p>
            )}
            {event.type === 'match' && !hasScore && isPast && (
              <p className="text-[11px] text-amber-400/80 italic mt-0.5">🙏 誰か戦績を入力して頂けるとありがたいです</p>
            )}
            {event.type === 'match' && !hasScore && event.startTime && <p className="text-xs text-slate-400">⏰ {event.startTime} K.O.</p>}
            {event.type !== 'match' && (event.startTime || event.endTime) && (
              <p className="text-xs text-slate-400">⏰ {event.startTime ?? ''}{event.startTime && event.endTime ? ' 〜 ' : ''}{event.endTime ?? ''}</p>
            )}
            {event.location && <p className="text-xs text-slate-400 truncate">📍 {event.location}</p>}
            {(event.meetingTime || event.meetingPlace) && (
              <p className="text-xs text-amber-300/90 mt-0.5">
                🚩 集合{event.meetingTime ? ` ${event.meetingTime}` : ''}{event.meetingPlace ? ` ${event.meetingPlace}` : ''}
              </p>
            )}
            {event.maxParkingSlots !== undefined && (
              event.maxParkingSlots === 0
                ? <p className="text-xs text-red-400/80 mt-0.5">🚫 駐車場なし</p>
                : event.maxParkingSlots === -1
                  ? <p className="text-xs text-emerald-400/80 mt-0.5">🅿️ 駐車場制限なし</p>
                  : <p className="text-xs text-blue-400/80 mt-0.5">🅿️ 駐車場 {event.maxParkingSlots}台</p>
            )}
          </div>
          {/* Actions */}
          <div className="flex flex-col gap-2 flex-shrink-0 items-end">
            <div className="flex flex-col gap-0.5">
              <button onClick={onEdit} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700">編集</button>
              <button onClick={onDelete} className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-slate-700">削除</button>
            </div>
            <button
              onClick={() => setExpanded(p => !p)}
              className="text-sm font-bold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-600 border border-white/10 transition-colors whitespace-nowrap"
            >
              {expanded ? '閉じる' : '詳細'}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="bg-slate-800/80 border-t border-white/10 px-4 py-3 space-y-4">
          {/* 各試合の詳細 */}
          {event.type === 'match' && eventMatches.map((m, i) => (
            <div key={m.id} className={i > 0 ? 'border-t border-white/10 pt-3' : ''}>
              {(matchCount > 1 || m.roundName) && (
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  {matchCount > 1 ? `試合 ${i + 1}${m.dayNumber && m.dayNumber > 1 ? ` (${m.dayNumber}日目)` : ''}` : ''}
                  {m.roundName ? `${matchCount > 1 ? ' — ' : ''}${m.roundName}` : ''}
                </p>
              )}
              {m.opponentName && matchCount > 1 && (
                <p className="text-sm font-semibold text-white mb-1">🆚 {m.opponentName}</p>
              )}
              {/* スコア内訳 */}
              {(m.homeScore != null || m.halfTimeHomeScore != null || m.hasExtraTime || m.hasPK) && (
                <div className="space-y-1 text-xs mb-2">
                  {(m.halfTimeHomeScore != null || m.halfTimeAwayScore != null) && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 w-12">前半</span>
                      <span className="text-white font-semibold">{m.halfTimeHomeScore ?? '-'} − {m.halfTimeAwayScore ?? '-'}</span>
                    </div>
                  )}
                  {m.homeScore != null && m.awayScore != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 w-12">合計</span>
                      <span className="text-white font-semibold">{m.homeScore} − {m.awayScore}</span>
                    </div>
                  )}
                  {m.hasExtraTime && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 w-12">延長</span>
                      <span className="text-white font-semibold">{m.extraTimeHomeScore ?? '-'} − {m.extraTimeAwayScore ?? '-'}</span>
                    </div>
                  )}
                  {m.hasPK && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 w-12">PK</span>
                      <span className="text-white font-semibold">{m.pkHomeScore ?? '-'} − {m.pkAwayScore ?? '-'}</span>
                    </div>
                  )}
                </div>
              )}
              {/* 得点者 */}
              {m.scorers && m.scorers.length > 0 && (
                <div className="mb-1.5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">⚽ 得点者</p>
                  <div className="flex flex-wrap gap-1.5">
                    {m.scorers.map(s => {
                      const mem = getMember(s.memberId);
                      return <span key={s.memberId} className="text-xs bg-green-600/20 text-green-300 px-2 py-0.5 rounded-full">#{mem?.number} {mem?.name} {s.count > 1 ? `×${s.count}` : ''}</span>;
                    })}
                  </div>
                </div>
              )}
              {/* アシスト */}
              {m.assists && m.assists.length > 0 && (
                <div className="mb-1.5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">🎯 アシスト</p>
                  <div className="flex flex-wrap gap-1.5">
                    {m.assists.map(s => {
                      const mem = getMember(s.memberId);
                      return <span key={s.memberId} className="text-xs bg-blue-600/20 text-blue-300 px-2 py-0.5 rounded-full">#{mem?.number} {mem?.name} {s.count > 1 ? `×${s.count}` : ''}</span>;
                    })}
                  </div>
                </div>
              )}
              {m.memo && <p className="text-xs text-slate-300 italic">💬 {m.memo}</p>}
              {/* 動画URL */}
              {m.videoUrl && (
                <a href={m.videoUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1 text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2">
                  🎬 動画を見る
                </a>
              )}
            </div>
          ))}

          {/* Note */}
          {event.note && <p className="text-xs text-slate-400">📝 {event.note}</p>}

          {/* Google Maps */}
          {(event.type === 'camp' || event.type === 'expedition') && event.mapQuery && (
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">🗺️ 場所</p>
              <iframe
                src={`https://maps.google.com/maps?q=${encodeURIComponent(event.mapQuery)}&output=embed&hl=ja&z=8`}
                width="100%"
                height="180"
                className="rounded-xl border border-white/10"
                loading="lazy"
              />
              <a
                href={`https://www.google.co.jp/maps/search/${encodeURIComponent(event.mapQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-400 hover:text-blue-300"
              >
                🗺️ Google マップで開く
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- MiniEventCard (カレンダー直下の次の予定プレビュー用) ----
function MiniEventCard({ event, members, onClick }: { event: SchEvent; members: SchMember[]; onClick: () => void }) {
  const isPast = isEventPast(event);
  const cfg = tc(event.type);
  return (
    <button onClick={onClick} className={`w-full text-left rounded-xl border overflow-hidden transition-colors hover:brightness-110 ${isPast ? 'opacity-60 border-white/5' : cfg.border} ${cfg.bg}`}>
      <div className="px-2.5 py-2">
        <div className="flex items-start gap-1.5">
          <div className="text-center px-1.5 py-1 rounded-lg flex-shrink-0 min-w-[36px] bg-black/20 text-white">
            <p className="text-[9px] leading-tight">{event.date.slice(5)}</p>
            <p className="text-xs font-bold leading-tight">{dayLabel(event.date)}</p>
          </div>
          <div className="flex-1 min-w-0">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
            <p className="text-xs font-bold text-white mt-0.5 truncate">
              {event.type === 'match'
                ? (() => { const ms = getMatches(event); return ms.length > 1 ? `🆚 ${ms[0]?.opponentName ?? '?'} 他${ms.length - 1}試合` : (ms[0]?.opponentName ? `🆚 ${ms[0].opponentName}` : '相手未定'); })()
                : (event.label || event.location || '詳細未定')}
            </p>
            {event.startTime && <p className="text-[10px] text-slate-400 leading-tight">⏰ {event.startTime}</p>}
          </div>
        </div>
      </div>
    </button>
  );
}

// ---- SchCalendar ----
function SchCalendar({ events, today, onSelectDate }: {
  events: SchEvent[];
  today: string;
  onSelectDate: (date: string) => void;
}) {
  const [viewYear, setViewYear] = useState(() => parseInt(today.split('/')[0]));
  const [viewMonth, setViewMonth] = useState(() => parseInt(today.split('/')[1]));

  // Single-day events → dots
  const dotMap = useMemo(() => {
    const map: Record<string, SchEvent[]> = {};
    events.forEach(e => {
      if (!e.endDate || e.endDate <= e.date) {
        if (!map[e.date]) map[e.date] = [];
        map[e.date].push(e);
      }
    });
    return map;
  }, [events]);

  // Multi-day events per date in view → horizontal bars
  const multiDayEvs = useMemo(
    () => events.filter(e => e.endDate && e.endDate > e.date),
    [events]
  );
  const spanMap = useMemo(() => {
    const dim = new Date(viewYear, viewMonth, 0).getDate();
    const map: Record<string, SchEvent[]> = {};
    for (let d = 1; d <= dim; d++) {
      const ds = `${viewYear}/${String(viewMonth).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
      map[ds] = multiDayEvs.filter(e => e.date <= ds && e.endDate! >= ds);
    }
    return map;
  }, [multiDayEvs, viewYear, viewMonth]);

  const prevMonth = () => { if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); } else setViewMonth(m => m + 1); };

  const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-slate-800/60 border border-white/10 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700">‹</button>
        <p className="text-sm font-bold text-white">{viewYear}年{viewMonth}月</p>
        <button onClick={nextMonth} className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700">›</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-semibold py-0.5 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-500'}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="h-12" />;
          const dateStr = `${viewYear}/${String(viewMonth).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
          const dots = dotMap[dateStr] ?? [];
          const spanning = spanMap[dateStr] ?? [];
          const isToday = dateStr === today;
          const dow = i % 7;
          return (
            <button
              key={i}
              onClick={() => onSelectDate(dateStr)}
              className={`relative flex flex-col items-center pt-1 h-12 transition-colors ${isToday ? 'bg-blue-600/30 ring-1 ring-blue-400/50 rounded-lg' : 'hover:bg-slate-700/60 rounded-lg'}`}
            >
              <span className={`text-xs font-semibold leading-none z-10 ${isToday ? 'text-blue-300' : dow === 0 ? 'text-red-400/80' : dow === 6 ? 'text-blue-400/80' : 'text-slate-300'}`}>{day}</span>
              {/* Single-day dots — directly below the number */}
              {dots.length > 0 && (
                <div className="flex gap-0.5 items-center justify-center mt-1 z-10">
                  {dots.slice(0, 3).map((e, j) => (
                    <span key={j} className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${EVENT_DOT[e.type] ?? 'bg-slate-400'}`} />
                  ))}
                  {dots.length > 3 && <span className="text-[7px] text-slate-400 leading-none">+</span>}
                </div>
              )}
              {/* Multi-day bars — thick, at bottom, spanning across adjacent cells */}
              {spanning.slice(0, 3).map((e, j) => {
                const isStart = e.date === dateStr;
                const isEnd = e.endDate === dateStr;
                const isRowStart = dow === 0;
                const isRowEnd = dow === 6;
                const roundL = isStart || isRowStart;
                const roundR = isEnd || isRowEnd;
                const color = EVENT_DOT[e.type] ?? 'bg-slate-400';
                return (
                  <div
                    key={e.id}
                    className={`absolute h-[4px] ${color}`}
                    style={{
                      bottom: `${3 + j * 6}px`,
                      left: isStart && !isRowStart ? '50%' : 0,
                      right: isEnd && !isRowEnd ? '50%' : 0,
                      borderRadius: `${roundL ? '9999px' : '0'} ${roundR ? '9999px' : '0'} ${roundR ? '9999px' : '0'} ${roundL ? '9999px' : '0'}`,
                    }}
                  />
                );
              })}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-500 text-center mt-2">予定あり→スクロール　空白日→予定を追加</p>
    </div>
  );
}

// ---- EventSection ----
type EventFilter = 'all' | SchEventType;

function EventSection({ events, members, onSave }: {
  events: SchEvent[];
  members: SchMember[];
  onSave: (events: SchEvent[]) => void;
}) {
  const [filter, setFilter] = useState<EventFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SchEvent | null>(null);
  const [calendarDate, setCalendarDate] = useState<string | null>(null);
  const today = todayStr();

  const handleSave = (ev: SchEvent) => {
    const updated = editing
      ? events.map(e => e.id === ev.id ? ev : e)
      : [...events, ev];
    onSave(updated.sort((a, b) => a.date.localeCompare(b.date)));
  };
  const handleDelete = (id: string) => {
    if (window.confirm('削除しますか？')) onSave(events.filter(e => e.id !== id));
  };
  const openEdit = (ev: SchEvent) => { setEditing(ev); setShowForm(true); };

  const filtered = events.filter(e =>
    filter === 'all' ||
    e.type === filter ||
    (filter === 'practice' && (e.type as string) === 'schedule') ||
    (filter === 'camp' && e.type === 'expedition')
  );
  const upcoming = filtered.filter(e => !isEventPast(e)).sort((a, b) => a.date.localeCompare(b.date));
  const past = filtered.filter(e => isEventPast(e)).sort((a, b) => b.date.localeCompare(a.date));

  const filterBtns: { key: EventFilter; icon: string; label: string }[] = [
    { key: 'all',      icon: '📅', label: '全て' },
    { key: 'practice', icon: '⚽', label: '練習' },
    { key: 'match',    icon: '🏆', label: '試合' },
    { key: 'camp',     icon: '🏕️', label: '合宿/遠征' },
    { key: 'other',    icon: '📌', label: 'その他' },
  ];

  return (
    <div className="space-y-3">
      <button
        onClick={() => { setEditing(null); setShowForm(true); }}
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <span className="text-lg">＋</span> 予定を追加
      </button>

      {/* Filter tags */}
      <div className="flex gap-1">
        {filterBtns.map(({ key, icon, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-1 py-1.5 rounded-lg border font-semibold transition-colors text-center ${filter === key ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white'}`}
          >
            <div className="text-sm leading-none">{icon}</div>
            <div className="text-[9px] leading-tight mt-0.5">{label}</div>
          </button>
        ))}
      </div>

      {/* ── 次の予定プレビュー（最大3件） ── */}
      {upcoming.length > 0 && (
        <div>
          {/* 1件目：フルサイズ */}
          <EventCard
            event={upcoming[0]}
            members={members}
            onEdit={() => openEdit(upcoming[0])}
            onDelete={() => handleDelete(upcoming[0].id)}
          />
          {/* 2・3件目：ミニカード横並び */}
          {upcoming.length >= 2 && (
            <div className="flex gap-2 mt-2">
              {upcoming.slice(1, 3).map(ev => (
                <div key={ev.id} className="flex-1 min-w-0">
                  <MiniEventCard event={ev} members={members} onClick={() => openEdit(ev)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── カレンダー ── */}
      <SchCalendar
        events={events}
        today={today}
        onSelectDate={(date) => {
          const eventsOnDate = events.filter(e =>
            e.date === date || (e.endDate && e.date <= date && e.endDate >= date)
          );
          if (eventsOnDate.length > 0) {
            const firstEv = eventsOnDate.sort((a, b) => a.date.localeCompare(b.date))[0];
            const isUpcoming = !isEventPast(firstEv);
            if (!isUpcoming) {
              const pastDetails = document.getElementById('past-events-details') as HTMLDetailsElement | null;
              if (pastDetails) pastDetails.open = true;
            }
            setTimeout(() => {
              const el = document.getElementById(`event-card-${firstEv.id}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
          } else {
            setCalendarDate(date);
            setEditing(null);
            setShowForm(true);
          }
        }}
      />

      {/* ── 全予定リスト ── */}
      {upcoming.length === 0 && past.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-4">予定がありません</p>
      )}
      {upcoming.length > 0 && (
        <details open>
          <summary className="text-[11px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer select-none mb-2 list-none flex items-center gap-1">
            <span>📅 全予定 ({upcoming.length}件)</span>
          </summary>
          <div className="space-y-2 mt-2">
            {upcoming.map(ev => (
              <div key={ev.id} id={`event-card-${ev.id}`}>
                <EventCard event={ev} members={members} onEdit={() => openEdit(ev)} onDelete={() => handleDelete(ev.id)} />
              </div>
            ))}
          </div>
        </details>
      )}
      {past.length > 0 && (
        <details className="mt-2" id="past-events-details">
          <summary className="text-xs text-slate-500 cursor-pointer mb-2 select-none">過去の予定 ({past.length}件)</summary>
          <div className="space-y-2 mt-2">
            {past.map(ev => (
              <div key={ev.id} id={`event-card-${ev.id}`}>
                <EventCard event={ev} members={members} onEdit={() => openEdit(ev)} onDelete={() => handleDelete(ev.id)} />
              </div>
            ))}
          </div>
        </details>
      )}

      {showForm && (
        <EventForm
          initialEvent={editing ?? undefined}
          initialDate={editing ? undefined : (calendarDate ?? undefined)}
          members={members}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); setCalendarDate(null); }}
        />
      )}
    </div>
  );
}

// ---- VideoLink ----
function VideoLink({ url }: { url: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'broken'>('loading');
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/check-url?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then((d: { ok: boolean }) => { if (!cancelled) setState(d.ok ? 'ok' : 'broken'); })
      .catch(() => { if (!cancelled) setState('broken'); });
    return () => { cancelled = true; };
  }, [url]);
  if (state === 'loading') return <span className="text-[10px] text-slate-500 animate-pulse">🎬…</span>;
  if (state === 'broken') return <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">リンク切れ</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="text-[10px] text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-1.5 py-0.5 rounded transition-colors shrink-0">
      🎬 動画
    </a>
  );
}

// ---- StatsSection ----
type StatTab = 'overall' | 'byType' | 'byOpponent' | 'byPeriod';

function StatsSection({ events, members }: { events: SchEvent[]; members: SchMember[] }) {
  const [statTab, setStatTab] = useState<StatTab>('overall');

  // 全試合（SchMatch）を収集
  const allMatches = useMemo(
    () => events.filter(e => e.type === 'match').flatMap(e => getMatches(e)),
    [events]
  );
  const scoredMatches = useMemo(
    () => allMatches.filter(m => m.homeScore != null && m.awayScore != null),
    [allMatches]
  );

  const calcRecord = (ms: SchMatch[]) => {
    const scored = ms.filter(m => m.homeScore != null && m.awayScore != null);
    const w = scored.filter(m => m.homeScore! > m.awayScore!).length;
    const d = scored.filter(m => m.homeScore! === m.awayScore!).length;
    const l = scored.filter(m => m.homeScore! < m.awayScore!).length;
    const gf = scored.reduce((sum, m) => sum + (m.homeScore ?? 0), 0);
    const ga = scored.reduce((sum, m) => sum + (m.awayScore ?? 0), 0);
    return { w, d, l, gf, ga, total: scored.length };
  };

  const overall = useMemo(() => calcRecord(scoredMatches), [scoredMatches]);

  // byType: イベントのmatchTypeで試合を分類
  const byType = useMemo(() => MATCH_TYPES.map(mt => {
    const evIds = new Set(events.filter(e => e.type === 'match' && (e.matchType ?? 'その他') === mt).map(e => e.id));
    const ms = scoredMatches.filter(m => {
      // SchMatchのidはeventId+'_0'(レガシー) or 独立id。eventsで引き当て
      const ev = events.find(e => e.type === 'match' && (e.matches?.some(x => x.id === m.id) || m.id === e.id + '_0'));
      return ev && evIds.has(ev.id);
    });
    return { type: mt, ...calcRecord(ms) };
  }), [events, scoredMatches]);

  // byOpponent
  const byOpponent = useMemo(() => {
    const opponents = [...new Set(scoredMatches.map(m => m.opponentName).filter((x): x is string => !!x))].sort();
    return opponents.map(opp => ({
      opp,
      ...calcRecord(scoredMatches.filter(m => m.opponentName === opp)),
    }));
  }, [scoredMatches]);

  // byPeriod: イベントの日付で分類
  const byPeriod = useMemo(() => {
    const year = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, i) => {
      const month = String(i + 1).padStart(2, '0');
      const prefix = `${year}/${month}`;
      const evIds = new Set(events.filter(e => e.type === 'match' && e.date.startsWith(prefix)).map(e => e.id));
      const ms = scoredMatches.filter(m => {
        const ev = events.find(e => e.type === 'match' && (e.matches?.some(x => x.id === m.id) || m.id === e.id + '_0'));
        return ev && evIds.has(ev.id);
      });
      return { month: `${i + 1}月`, ...calcRecord(ms) };
    }).filter(m => m.total > 0);
  }, [events, scoredMatches]);

  // Top scorers
  const topScorers = useMemo(() => {
    const counts: Record<string, number> = {};
    allMatches.forEach(m => {
      (m.scorers ?? []).forEach(s => {
        counts[s.memberId] = (counts[s.memberId] ?? 0) + s.count;
      });
    });
    return Object.entries(counts)
      .map(([id, count]) => ({ member: members.find(m => m.id === id), count }))
      .filter(x => x.member)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [allMatches, members]);

  const statTabs: { key: StatTab; label: string }[] = [
    { key: 'overall',    label: '通算' },
    { key: 'byType',     label: '区分別' },
    { key: 'byOpponent', label: '相手別' },
    { key: 'byPeriod',   label: '期間別' },
  ];

  if (scoredMatches.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p className="text-3xl mb-3">🏆</p>
        <p className="text-sm">試合結果を登録すると戦績が表示されます</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex bg-slate-800/60 rounded-xl p-1 border border-white/10">
        {statTabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatTab(key)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${statTab === key ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-300'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Overall */}
      {statTab === 'overall' && (
        <div className="space-y-4">
          <div className="bg-slate-800/60 border border-white/10 rounded-xl p-5">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-3">通算成績 ({overall.total}試合)</p>
            <div className="flex items-center justify-center gap-6 mb-4">
              <div className="text-center">
                <p className="text-3xl font-extrabold text-green-400">{overall.w}</p>
                <p className="text-xs text-slate-400 mt-0.5">勝</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-extrabold text-slate-400">{overall.d}</p>
                <p className="text-xs text-slate-400 mt-0.5">分</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-extrabold text-red-400">{overall.l}</p>
                <p className="text-xs text-slate-400 mt-0.5">敗</p>
              </div>
            </div>
            <div className="flex justify-center gap-4 text-sm">
              <span className="text-slate-300">{overall.gf}得点</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-300">{overall.ga}失点</span>
              <span className="text-slate-500">|</span>
              <span className={overall.gf > overall.ga ? 'text-green-400' : overall.gf < overall.ga ? 'text-red-400' : 'text-slate-400'}>
                {overall.gf > overall.ga ? '+' : ''}{overall.gf - overall.ga}
              </span>
            </div>
          </div>

          {/* Win rate bar */}
          {overall.total > 0 && (
            <div className="bg-slate-800/60 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-400">勝率</p>
                <p className="text-xs font-bold text-white">{Math.round(overall.w / overall.total * 100)}%</p>
              </div>
              <div className="flex rounded-full overflow-hidden h-3 bg-slate-700">
                <div className="bg-green-500 transition-all" style={{ width: `${overall.w / overall.total * 100}%` }} />
                <div className="bg-slate-500 transition-all" style={{ width: `${overall.d / overall.total * 100}%` }} />
                <div className="bg-red-500 transition-all" style={{ width: `${overall.l / overall.total * 100}%` }} />
              </div>
            </div>
          )}

          {/* Top scorers */}
          {topScorers.length > 0 && (
            <div className="bg-slate-800/60 border border-white/10 rounded-xl p-4">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-3">⚽ 得点ランキング</p>
              <div className="space-y-2">
                {topScorers.map(({ member, count }, i) => (
                  <div key={member!.id} className="flex items-center gap-3">
                    <span className="text-slate-500 text-xs w-5 text-center">{i + 1}</span>
                    <span className="text-xs text-white flex-1">#{member!.number} {member!.name}</span>
                    <span className="text-sm font-bold text-green-400">{count}G</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* By type */}
      {statTab === 'byType' && (
        <div className="space-y-2">
          {byType.filter(t => t.total > 0).map(t => (
            <div key={t.type} className="bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{t.type}</span>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-green-400 font-bold">{t.w}勝</span>
                  <span className="text-slate-400">{t.d}分</span>
                  <span className="text-red-400 font-bold">{t.l}敗</span>
                  <span className="text-slate-500 text-xs">({t.gf}−{t.ga})</span>
                </div>
              </div>
            </div>
          ))}
          {byType.every(t => t.total === 0) && <p className="text-center text-slate-400 text-sm py-4">データがありません</p>}
        </div>
      )}

      {/* By opponent */}
      {statTab === 'byOpponent' && (
        <div className="space-y-2">
          {byOpponent.length === 0 && <p className="text-center text-slate-400 text-sm py-4">対戦相手が登録されていません</p>}
          {byOpponent.map(o => (
            <div key={o.opp} className="bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white truncate max-w-[160px]">{o.opp}</p>
                  <p className="text-xs text-slate-500">{o.total}試合</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-400 font-bold">{o.w}勝</span>
                  <span className="text-slate-400">{o.d}分</span>
                  <span className="text-red-400 font-bold">{o.l}敗</span>
                  <span className="text-slate-500 text-xs">({o.gf}−{o.ga})</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* By period */}
      {statTab === 'byPeriod' && (
        <div className="space-y-2">
          {byPeriod.length === 0 && <p className="text-center text-slate-400 text-sm py-4">今年の試合データがありません</p>}
          {byPeriod.map(p => (
            <div key={p.month} className="bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{p.month}</p>
                  <p className="text-xs text-slate-500">{p.total}試合</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-400 font-bold">{p.w}勝</span>
                  <span className="text-slate-400">{p.d}分</span>
                  <span className="text-red-400 font-bold">{p.l}敗</span>
                  <span className="text-slate-500 text-xs">({p.gf}−{p.ga})</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 試合結果サマリー一覧 ── */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">📋 試合結果一覧</p>
        <div className="space-y-2">
          {events
            .filter(e => e.type === 'match')
            .sort((a, b) => b.date.localeCompare(a.date))
            .map(ev => {
              const matches = getMatches(ev);
              const scored = matches.filter(m => m.homeScore != null && m.awayScore != null);
              if (scored.length === 0) return null;
              return (
                <div key={ev.id} className="bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-slate-400">{ev.date}</span>
                    {ev.matchType && (
                      <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{ev.matchType}</span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {scored.map(m => {
                      const won = m.homeScore! > m.awayScore!;
                      const drew = m.homeScore! === m.awayScore!;
                      return (
                        <div key={m.id} className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold w-5 text-center px-1 py-0.5 rounded ${won ? 'bg-green-500/20 text-green-400' : drew ? 'bg-slate-600/50 text-slate-400' : 'bg-red-500/20 text-red-400'}`}>
                            {won ? '勝' : drew ? '分' : '負'}
                          </span>
                          <span className="text-sm font-bold text-white tabular-nums">{m.homeScore} − {m.awayScore}</span>
                          {m.opponentName && <span className="text-xs text-slate-400 truncate">vs {m.opponentName}</span>}
                          {m.roundName && <span className="text-[10px] text-slate-500 shrink-0">({m.roundName})</span>}
                          {m.videoUrl && <VideoLink url={m.videoUrl} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
            .filter(Boolean)
          }
          {events.filter(e => e.type === 'match' && getMatches(e).some(m => m.homeScore != null)).length === 0 && (
            <p className="text-center text-slate-400 text-sm py-4">試合結果がありません</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- ParkingHistorySection ----
function ParkingHistorySection({
  pastEvents, sortedMembers, parkingRecords, onSaveHistory,
}: {
  pastEvents: SchEvent[];
  sortedMembers: SchMember[];
  parkingRecords: SchParkingRecord[];
  onSaveHistory: (eventId: string, slots: SchParkingSlot[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  // draft: memberId -> 'used' | 'pending' | 'skipped'
  const [draft, setDraft] = useState<Record<string, 'used' | 'pending' | 'skipped'>>({});

  const openEdit = (ev: SchEvent) => {
    const record = parkingRecords.find(r => r.eventId === ev.id);
    const init: Record<string, 'used' | 'pending' | 'skipped'> = {};
    if (record) {
      record.slots.forEach(s => { init[s.memberId] = s.status; });
    }
    setDraft(init);
    setEditingId(ev.id);
  };

  const setStatus = (memberId: string, status: 'used' | 'pending' | 'skipped') => {
    setDraft(prev => ({ ...prev, [memberId]: status }));
  };

  const saveEdit = (eventId: string) => {
    const slots: SchParkingSlot[] = Object.entries(draft)
      .filter(([, s]) => s !== 'pending')
      .map(([memberId, status]) => ({ memberId, status }));
    onSaveHistory(eventId, slots);
    setEditingId(null);
  };

  const evLabel = (ev: SchEvent) =>
    ev.type === 'match' ? (() => { const opp = getMatches(ev)[0]?.opponentName || ev.opponentName; return opp ? `vs ${opp}` : '試合'; })() : (ev.label || ev.location || tc(ev.type).label);

  return (
    <details className="group" open>
      <summary className="text-[11px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer list-none flex items-center gap-1.5 select-none">
        <span className="transition-transform group-open:rotate-90 inline-block">▶</span>
        🕐 駐車場利用履歴
      </summary>
      <div className="mt-2 space-y-2">
        {pastEvents.map(ev => {
          const record = parkingRecords.find(r => r.eventId === ev.id);
          const isEditing = editingId === ev.id;
          const usedSlots = record?.slots.filter(s => s.status === 'used') ?? [];
          const skippedSlots = record?.slots.filter(s => s.status === 'skipped') ?? [];
          const hasRecord = !!record && record.slots.length > 0;

          return (
            <div key={ev.id} className="bg-slate-800/60 border border-white/5 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="px-3 py-2 bg-slate-700/40 flex items-center gap-2">
                <span className="text-[10px] text-slate-400">{ev.date.slice(5).replace('/', '/')}({dayLabel(ev.date)})</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tc(ev.type).badge}`}>{tc(ev.type).icon}</span>
                <span className="text-xs text-white font-medium truncate flex-1">{evLabel(ev)}</span>
                {isEditing ? (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => saveEdit(ev.id)} className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold">保存</button>
                    <button onClick={() => setEditingId(null)} className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded border border-slate-600">取消</button>
                  </div>
                ) : (
                  <button onClick={() => openEdit(ev)} className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded border border-slate-600 hover:border-slate-400 flex-shrink-0">編集</button>
                )}
              </div>

              {/* Body */}
              {isEditing ? (
                <div className="px-3 py-2 space-y-1">
                  {sortedMembers.map(m => {
                    const st = draft[m.id] ?? 'pending';
                    return (
                      <div key={m.id} className="flex items-center gap-2 text-xs">
                        <span className="text-blue-300 w-8 text-center font-bold">#{m.number}</span>
                        <span className="text-slate-300 flex-1">{m.nameKana || m.name}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setStatus(m.id, 'used')}
                            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${st === 'used' ? 'bg-green-500/30 text-green-300 border-green-500/50' : 'text-slate-500 border-slate-700 hover:border-green-500/40 hover:text-green-400'}`}
                          >✓ 使用</button>
                          <button
                            onClick={() => setStatus(m.id, 'skipped')}
                            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${st === 'skipped' ? 'bg-amber-500/30 text-amber-300 border-amber-500/50' : 'text-slate-500 border-slate-700 hover:border-amber-500/40 hover:text-amber-400'}`}
                          >スキップ</button>
                          <button
                            onClick={() => setStatus(m.id, 'pending')}
                            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${st === 'pending' ? 'bg-slate-600/50 text-slate-300 border-slate-500' : 'text-slate-600 border-slate-700 hover:border-slate-500 hover:text-slate-400'}`}
                          >─</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : hasRecord ? (
                <div className="px-3 py-1.5 space-y-1">
                  {usedSlots.map((slot, i) => {
                    const m = sortedMembers.find(mb => mb.id === slot.memberId);
                    if (!m) return null;
                    return (
                      <div key={slot.memberId} className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 w-3 text-right">{i + 1}</span>
                        <span className="text-blue-300 w-8 text-center font-bold">#{m.number}</span>
                        <span className="text-slate-300 flex-1">{m.nameKana || m.name}</span>
                        <span className="text-[10px] bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded-full">✓ 使用</span>
                      </div>
                    );
                  })}
                  {skippedSlots.map(slot => {
                    const m = sortedMembers.find(mb => mb.id === slot.memberId);
                    if (!m) return null;
                    return (
                      <div key={slot.memberId} className="flex items-center gap-2 text-xs opacity-60">
                        <span className="text-slate-500 w-3">─</span>
                        <span className="text-slate-400 w-8 text-center">#{m.number}</span>
                        <span className="text-slate-400 flex-1">{m.nameKana || m.name}</span>
                        <span className="text-amber-500/80 text-[10px]">スキップ{slot.skipComment ? `（${slot.skipComment}）` : ''}</span>
                      </div>
                    );
                  })}
                </div>
              ) : ev.maxParkingSlots === -1 ? (
                <div className="px-3 py-2">
                  <span className="text-[11px] text-emerald-700 italic">上限なし — 記録不要</span>
                </div>
              ) : (
                <div className="px-3 py-2">
                  <span className="text-[11px] text-slate-600 italic">未記録 — 「編集」から入力できます</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}

// ---- HomeSection ----
function HomeSection({
  events, members, parkingRecords, parkingRotation, nearbyParking, announcements, onGoToAnnounce,
  onSkip, onUnskip, onMarkUsed, onMarkPending, onSaveHistory, onUpdateMaxSlots,
}: {
  events: SchEvent[];
  members: SchMember[];
  parkingRecords: SchParkingRecord[];
  parkingRotation: number;
  nearbyParking: SchNearbyParking[];
  announcements: SchAnnouncement[];
  onGoToAnnounce: () => void;
  onSkip: (eventId: string, memberId: string, comment: string) => void;
  onUnskip: (eventId: string, memberId: string) => void;
  onMarkUsed: (eventId: string, memberId: string) => void;
  onMarkPending: (eventId: string, memberId: string) => void;
  onSaveHistory: (eventId: string, slots: SchParkingSlot[]) => void;
  onUpdateMaxSlots: (eventId: string, maxSlots: number) => void;
}) {
  const today = todayStr();
  const sortedMembers = useMemo(() => [...members].sort((a, b) => a.number - b.number), [members]);
  const [parkingShowCount, setParkingShowCount] = useState(3);
  const [nextExpanded, setNextExpanded] = useState(false);
  const [expandedAnnounces, setExpandedAnnounces] = useState<Set<string>>(new Set());
  const [weather, setWeather] = useState<{ code: number; maxTemp: number | null; minTemp: number | null; precip: number } | null>(null);

  const upcomingEvents = useMemo(
    () => events.filter(e => !isEventPast(e)).sort((a, b) => a.date.localeCompare(b.date)),
    [events, today]
  );
  const nextEvent = upcomingEvents[0];

  useEffect(() => {
    if (!nextEvent) { setWeather(null); return; }
    const targetDate = nextEvent.date.replace(/\//g, '-'); // "2026-03-27"
    // 気象庁API（神奈川県 = 140000）— Yahoo天気と同一データソース
    fetch('https://www.jma.go.jp/bosai/forecast/data/forecast/140000.json')
      .then(r => r.json())
      .then((data: any[]) => {
        const ts: any[] = data[0]?.timeSeries;
        if (!ts) { setWeather(null); return; }

        // 天気コード (ts[0])
        const wxTs = ts[0];
        const dayIdx = (wxTs.timeDefines as string[]).findIndex((t: string) => t.startsWith(targetDate));
        if (dayIdx < 0) { setWeather(null); return; }
        const wxArea = (wxTs.areas as any[]).find((a: any) => a.area.name === '横浜') ?? wxTs.areas[0];
        const code = parseInt(wxArea.weatherCodes?.[dayIdx] ?? '200');

        // 降水確率 (ts[1])
        const popTs = ts[1];
        const popArea = (popTs.areas as any[]).find((a: any) => a.area.name === '横浜') ?? popTs.areas[0];
        const pops: string[] = popArea.pops;
        const maxPop = (popTs.timeDefines as string[])
          .map((t: string, i: number) => ({ t, i }))
          .filter(({ t }) => t.startsWith(targetDate))
          .map(({ i }) => parseInt(pops[i]))
          .filter((p: number) => !isNaN(p))
          .reduce((m: number, p: number) => Math.max(m, p), 0);

        // 気温 (ts[2])
        const tempTs = ts[2];
        const tempArea = (tempTs.areas as any[]).find((a: any) => a.area.name === '横浜') ?? tempTs.areas[0];
        const temps: string[] = tempArea.temps;
        const dayTemps = (tempTs.timeDefines as string[])
          .map((t: string, i: number) => ({ t, i }))
          .filter(({ t }) => t.startsWith(targetDate))
          .map(({ i }) => parseInt(temps[i]))
          .filter((t: number) => !isNaN(t));

        setWeather({
          code,
          minTemp: dayTemps.length > 0 ? Math.min(...dayTemps) : null,
          maxTemp: dayTemps.length > 0 ? Math.max(...dayTemps) : null,
          precip:  maxPop,
        });
      })
      .catch(() => setWeather(null));
  }, [nextEvent?.date]);

  const toEventItem = (e: SchEvent): EventItem => ({
    id: e.id,
    date: e.date,
    endDate: e.endDate,
    endTime: e.endTime,
    type: e.type,
    label: e.type === 'match' ? (() => { const opp = getMatches(e)[0]?.opponentName || e.opponentName; return opp ? `🆚 ${opp}` : '相手未定'; })() : (e.label || e.location || tc(e.type).label),
    maxSlots: e.maxParkingSlots ?? DEFAULT_MAX_SLOTS,
  });

  const eventItems: EventItem[] = useMemo(
    () => upcomingEvents.slice(0, 20).map(toEventItem),
    [upcomingEvents]
  );

  const pastEvents = useMemo(
    () => [...events]
      .filter(e => e.date < today && e.maxParkingSlots !== 0)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10),
    [events, today]
  );

  const parkingPlan = useMemo(
    () => buildParkingPlan(sortedMembers, eventItems, parkingRotation, parkingRecords)
            .filter(p => p.maxSlots !== -1),
    [sortedMembers, eventItems, parkingRotation, parkingRecords]
  );

  return (
    <div className="space-y-5">
      {/* Next event */}
      <div>
        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">次の予定</h2>
        {nextEvent ? (
          <div className={`rounded-2xl border ${tc(nextEvent.type).border} ${tc(nextEvent.type).bg} overflow-hidden`}>
            <div className="flex">
              {/* メインコンテンツ */}
              <div className="flex-1 p-4 flex items-start gap-3 min-w-0">
                {(() => {
                  const rel = relativeDayLabel(nextEvent.date, today);
                  return (
                    <div className="text-center px-3 py-2 rounded-xl min-w-[56px] bg-black/20 text-white flex-shrink-0">
                      <p className="text-[10px] leading-tight text-slate-300">{nextEvent.date.slice(5)}</p>
                      <p className="text-lg font-extrabold leading-tight">{dayLabel(nextEvent.date)}</p>
                      <p className={`text-[10px] font-bold leading-tight mt-0.5 ${rel.color}`}>{rel.label}</p>
                    </div>
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tc(nextEvent.type).badge}`}>
                    {tc(nextEvent.type).icon} {tc(nextEvent.type).label}
                  </span>
                  <p className="text-base font-bold text-white mt-1.5 truncate">
                    {nextEvent.type === 'match' ? (() => {
                      const ms = getMatches(nextEvent);
                      const first = ms[0];
                      return ms.length > 1
                        ? (first?.opponentName ? `🆚 ${first.opponentName} ほか${ms.length - 1}試合` : `🏆 ${ms.length}試合`)
                        : (first?.opponentName ? `🆚 ${first.opponentName}` : '相手未定');
                    })() : (nextEvent.label || nextEvent.location || '詳細未定')}
                  </p>
                  {nextEvent.startTime && <p className="text-sm text-slate-300 mt-0.5">⏰ {nextEvent.startTime}{nextEvent.endTime ? ` 〜 ${nextEvent.endTime}` : ''}</p>}
                  {nextEvent.location && <p className="text-xs text-slate-400 mt-0.5">📍 {nextEvent.location}</p>}
                  {weather && (
                    <a
                      href="https://www.jma.go.jp/bosai/forecast/#area_type=offices&area_code=140000"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 mt-1.5 px-2 py-1.5 rounded-xl bg-black/20 border border-white/10 active:opacity-70"
                    >
                      <span className="text-xl leading-none">{weatherEmoji(weather.code)}</span>
                      <span className="text-sm font-bold text-white">{weatherLabel(weather.code)}</span>
                      {weather.minTemp !== null && <span className="text-xs text-blue-300">{weather.minTemp}°</span>}
                      {weather.minTemp !== null && weather.maxTemp !== null && <span className="text-xs text-slate-400">/</span>}
                      {weather.maxTemp !== null && <span className="text-xs text-red-300">{weather.maxTemp}°C</span>}
                      <span className="text-xs text-cyan-300 font-semibold">☔ {weather.precip}%</span>
                      <span className="ml-auto text-[10px] text-slate-500">気象庁 →</span>
                    </a>
                  )}
                  {(nextEvent.meetingTime || nextEvent.meetingPlace) && (
                    <p className="text-sm font-semibold text-amber-300 mt-1">
                      🚩 集合{nextEvent.meetingTime ? ` ${nextEvent.meetingTime}` : ''}{nextEvent.meetingPlace ? ` ${nextEvent.meetingPlace}` : ''}
                    </p>
                  )}
                </div>
              </div>
              {/* 縦長詳細ボタン */}
              <button
                onClick={() => setNextExpanded(p => !p)}
                className="w-10 flex-shrink-0 grid place-items-center border-l border-white/10 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <span className="flex flex-col items-center leading-tight">{(nextExpanded ? '閉じる' : '詳細').split('').map((c, i) => <span key={i}>{c}</span>)}</span>
              </button>
            </div>
            {/* 展開エリア */}
            {nextExpanded && (() => {
              const ms = nextEvent.type === 'match' ? getMatches(nextEvent) : [];
              const multiMatch = ms.length > 1;
              const hasNote = !!nextEvent.note;
              const hasMap = (nextEvent.type === 'camp' || nextEvent.type === 'expedition') && !!nextEvent.mapQuery;
              const nextPlan = parkingPlan[0];
              const showParking = !multiMatch && !hasNote && !hasMap;

              return (
                <div className="px-4 py-3 border-t border-white/10 space-y-2">
                  {multiMatch && (
                    <div className="space-y-1">
                      {ms.map((m, i) => (
                        <p key={m.id} className="text-xs text-slate-300">
                          試合{i + 1}{m.roundName ? ` (${m.roundName})` : ''}{m.opponentName ? ` 🆚 ${m.opponentName}` : ''}
                        </p>
                      ))}
                    </div>
                  )}
                  {hasNote && <p className="text-xs text-slate-300">📝 {nextEvent.note}</p>}
                  {hasMap && (
                    <div>
                      <iframe
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(nextEvent.mapQuery!)}&output=embed&hl=ja&z=8`}
                        width="100%" height="160"
                        className="rounded-xl border border-white/10"
                        loading="lazy"
                      />
                      <a href={`https://www.google.co.jp/maps/search/${encodeURIComponent(nextEvent.mapQuery!)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1 text-xs text-blue-400 hover:text-blue-300">
                        🗺️ Google マップで開く
                      </a>
                    </div>
                  )}
                  {showParking && (() => {
                    const hasSlots = (nextPlan?.slots.filter(s => s.status !== 'skipped').length ?? 0) > 0;
                    const limited = nextPlan && nextPlan.maxSlots !== -1;
                    return (
                      <p className="text-xs text-slate-300">
                        🅿️ 駐車場:{' '}
                        {hasSlots
                          ? <span className="text-slate-200">{limited ? 'あり（制限あり）' : 'あり（制限なし）'}</span>
                          : <span className="text-slate-500">なし</span>
                        }
                      </p>
                    );
                  })()}
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="rounded-2xl p-5 border bg-slate-800/40 border-white/5 text-center text-slate-400 text-sm">予定がありません</div>
        )}
      </div>

      {/* 最近のお知らせ（過去7日以内・最大3件） */}
      {(() => {
        const sevenDaysAgo = (() => {
          const d = new Date(today.replace(/\//g, '-'));
          d.setDate(d.getDate() - 7);
          return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
        })();
        const recent = announcements.filter(a => a.date >= sevenDaysAgo);
        if (recent.length === 0) return null;
        const shown = recent.slice(0, 3);
        const hasMore = recent.length > 3;
        return (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">📢 最近のお知らせ</h2>
              {hasMore && (
                <button onClick={onGoToAnnounce} className="text-[10px] text-purple-400 hover:text-purple-300">
                  すべて見る →
                </button>
              )}
            </div>
            <div className="space-y-2">
              {shown.map(a => {
                const isExpanded = expandedAnnounces.has(a.id);
                const toggleExpand = () => setExpandedAnnounces(prev => {
                  const next = new Set(prev);
                  isExpanded ? next.delete(a.id) : next.add(a.id);
                  return next;
                });
                const hasDetail = (a.content && a.content.length > 60) || !!a.url || !!(a.checkItems?.length);
                const isExpandedInstagram = isExpanded && !!a.url && isInstagramUrl(a.url);
                return (
                  <div key={a.id} className={`rounded-xl border ${isExpandedInstagram ? '' : 'overflow-hidden'} ${a.important ? 'bg-red-900/20 border-red-500/40' : 'bg-slate-800/60 border-white/10'}`}>
                    <div className={isExpandedInstagram ? '' : 'flex'}>
                      <div className="flex-1 px-4 py-3 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {a.important && <span className="text-[10px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-full">重要</span>}
                          <span className="text-[10px] text-slate-400">{a.date}</span>
                          {isExpandedInstagram && (
                            <button onClick={toggleExpand} className="ml-auto text-xs font-bold text-slate-400 hover:text-white px-2 py-0.5 rounded-lg hover:bg-white/10 transition-colors">閉じる ×</button>
                          )}
                        </div>
                        <p className="text-sm font-bold text-white">{a.title}</p>
                        {a.content && <p className={`text-xs text-slate-300 mt-0.5 whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-2'}`}>{a.content}</p>}
                        {isExpanded && a.checkItems && a.checkItems.length > 0 && <CheckList items={a.checkItems} announcementId={a.id} />}
                        {isExpanded && a.url && isInstagramUrl(a.url) && <InstagramEmbed url={a.url} />}
                        {isExpanded && a.url && !isInstagramUrl(a.url) && <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 hover:underline mt-1 block truncate">{a.url}</a>}
                        {!isExpanded && a.checkItems && a.checkItems.length > 0 && <p className="text-xs text-amber-300 mt-0.5">🎒 持ち物リストあり（{a.checkItems.length}件）</p>}
                        {!isExpanded && a.url && isInstagramUrl(a.url) && <p className="text-xs text-indigo-400 mt-0.5">📸 Instagram投稿あり</p>}
                      </div>
                      {hasDetail && !isExpandedInstagram && (
                        <button
                          onClick={toggleExpand}
                          className="w-10 flex-shrink-0 grid place-items-center border-l border-white/10 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <span className="flex flex-col items-center leading-tight">{(isExpanded ? '閉じる' : '詳細').split('').map((c, i) => <span key={i}>{c}</span>)}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {hasMore && (
                <button onClick={onGoToAnnounce}
                  className="w-full text-xs py-2.5 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:text-purple-300 hover:border-purple-500/50 transition-colors">
                  他 {recent.length - 3} 件のお知らせを見る
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Parking forecast */}
      <div>
        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">🅿️ 駐車場予定</h2>
        {sortedMembers.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-4">メンバーを登録してください</p>
        ) : parkingPlan.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-4">予定がありません</p>
        ) : (
          <div className="space-y-3">
            {parkingPlan.slice(0, parkingShowCount).map(plan => (
              <ParkingEventCard
                key={plan.id}
                plan={plan}
                members={sortedMembers}
                onSkip={onSkip}
                onUnskip={onUnskip}
                onMarkUsed={onMarkUsed}
                onUpdateMaxSlots={onUpdateMaxSlots}
              />
            ))}
            {parkingPlan.length > parkingShowCount && (
              <div>
                <button
                  onClick={() => setParkingShowCount(c => c + 10)}
                  className="w-full text-xs text-slate-400 hover:text-slate-300 py-2 rounded-lg bg-slate-800/60 border border-white/5 hover:bg-slate-700/40 transition-colors"
                >
                  ▼ さらに表示（先10件）
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nearby parking */}
      {nearbyParking.length > 0 && (
        <div>
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">🗺️ 近隣駐車場</h2>
          <div className="space-y-2">
            {nearbyParking.map(p => (
              <div key={p.id} className="bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-white">{p.name}</p>
                {p.address && <p className="text-xs text-slate-400 mt-0.5">📍 {p.address}</p>}
                {p.note && <p className="text-xs text-slate-400 mt-0.5">📝 {p.note}</p>}
                {p.googleMapsUrl && (
                  <a href={p.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-400 hover:text-blue-300">
                    🗺️ Google マップで開く
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parking history */}
      {pastEvents.length > 0 && (
        <ParkingHistorySection
          pastEvents={pastEvents}
          sortedMembers={sortedMembers}
          parkingRecords={parkingRecords}
          onSaveHistory={onSaveHistory}
        />
      )}

      {/* 戦歴バナー */}
      <Link href="/sch/history"
        className="flex items-center gap-3 bg-gradient-to-r from-blue-700 to-blue-500 rounded-2xl px-4 py-3 shadow hover:from-blue-800 hover:to-blue-600 transition-all active:scale-95"
      >
        <span className="text-2xl">🏆</span>
        <div className="flex-1">
          <p className="text-white text-sm font-bold leading-tight">先輩たちの戦歴を見る</p>
          <p className="text-blue-200 text-[10px] mt-0.5">2020年〜現在 U-10〜U-12 主要大会成績</p>
        </div>
        <span className="text-white/60 text-lg font-black">↗</span>
      </Link>

    </div>
  );
}

// ---- InstagramEmbed ----
function InstagramEmbed({ url }: { url: string }) {
  useEffect(() => {
    const process = () => (window as any).instgrm?.Embeds.process();
    if ((window as any).instgrm) {
      process();
    } else {
      const existing = document.getElementById('instagram-embed-js');
      if (!existing) {
        const s = document.createElement('script');
        s.id = 'instagram-embed-js';
        s.src = '//www.instagram.com/embed.js';
        s.async = true;
        s.onload = process;
        document.body.appendChild(s);
      } else {
        existing.addEventListener('load', process);
      }
    }
  }, [url]);
  return (
    <div className="mt-2 overflow-x-auto">
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        style={{ maxWidth: '100%', width: '100%', margin: '0', border: 'none', borderRadius: '12px' }}
      />
    </div>
  );
}

// ---- EventSummaryCard (連絡内に予定情報を表示するコンパクトカード) ----
function EventSummaryCard({ event }: { event: SchEvent }) {
  const cfg = tc(event.type);
  const ms = event.type === 'match' ? getMatches(event) : [];
  const day = dayLabel(event.date);
  const dateDisplay = `${event.date.slice(5).replace('/', '/')}（${day}）`;
  return (
    <div className={`rounded-lg p-3 border ${cfg.border} ${cfg.bg} space-y-1`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-sm">{cfg.icon}</span>
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${cfg.badge}`}>{cfg.label}</span>
        <span className="text-xs text-slate-300 font-medium">{dateDisplay}</span>
        {event.endDate && event.endDate !== event.date && <span className="text-xs text-slate-400">〜 {event.endDate.slice(5).replace('/', '/')}</span>}
      </div>
      {event.label && <p className="text-xs text-white font-semibold">{event.label}</p>}
      {event.type === 'match' && ms.length > 0 && (
        <div className="space-y-0.5">
          {ms.map((m, i) => m.opponentName ? (
            <p key={i} className="text-xs text-slate-200">🆚 {m.opponentName}{ms.length > 1 && m.roundName ? ` (${m.roundName})` : ''}</p>
          ) : null)}
        </div>
      )}
      <div className="space-y-0.5">
        {event.location && <p className="text-xs text-slate-400">📍 {event.location}</p>}
        {event.meetingTime && <p className="text-xs text-slate-400">🕐 集合 {event.meetingTime}{event.meetingPlace ? `　${event.meetingPlace}` : ''}</p>}
        {event.startTime && <p className="text-xs text-slate-400">⏰ {event.startTime} 開始</p>}
        {event.note && <p className="text-xs text-slate-500 mt-0.5">{event.note}</p>}
      </div>
    </div>
  );
}

// ---- CheckList ----
function CheckList({ items, announcementId }: { items: { text: string; note?: string }[]; announcementId: string }) {
  const storageKey = `sch-check-${announcementId}`;
  const [checked, setChecked] = useState<boolean[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const arr = JSON.parse(stored) as boolean[];
        // 長さが合わない場合は拡張
        if (arr.length < items.length) return [...arr, ...items.slice(arr.length).map(() => false)];
        return arr;
      }
    } catch { /* ignore */ }
    return items.map(() => false);
  });

  const toggle = (i: number) => {
    const next = checked.map((v, idx) => idx === i ? !v : v);
    setChecked(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const doneCount = checked.filter(Boolean).length;

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-amber-300">🎒 持ち物リスト</span>
        <span className="text-[10px] text-slate-500">{doneCount}/{items.length} 準備済み</span>
        {doneCount === items.length && items.length > 0 && (
          <span className="text-[10px] text-green-400 font-bold">✓ 完了!</span>
        )}
      </div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <label
            key={i}
            className={`flex items-start gap-2.5 py-2 px-3 rounded-lg cursor-pointer transition-all select-none ${
              checked[i] ? 'bg-slate-700/30 opacity-50' : 'bg-slate-700/60 hover:bg-slate-700/80'
            }`}
          >
            <input
              type="checkbox"
              checked={checked[i] ?? false}
              onChange={() => toggle(i)}
              className="w-4 h-4 accent-green-500 flex-shrink-0 mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <span className={`text-sm block ${checked[i] ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                {item.text}
              </span>
              {item.note && (
                <span className="text-[10px] text-slate-500 block mt-0.5">{item.note}</span>
              )}
            </div>
          </label>
        ))}
      </div>
      <p className="text-[10px] text-slate-600 pt-1.5">✓ チェックはこのデバイスにのみ保存されます</p>
    </div>
  );
}

// ---- AnnounceSection ----
function AnnounceSection({ announcements, onSave, events }: { announcements: SchAnnouncement[]; onSave: (a: SchAnnouncement[]) => void; events: SchEvent[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SchAnnouncement | null>(null);
  const [date, setDate] = useState(todayStr());
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [important, setImportant] = useState(false);
  const [url, setUrl] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<SchEvent | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [checkItems, setCheckItems] = useState<{ text: string; note: string }[]>([]);
  const [showCheckItems, setShowCheckItems] = useState(false);

  const resetForm = () => {
    setDate(todayStr()); setTitle(''); setContent(''); setImportant(false); setUrl('');
    setEditing(null); setShowForm(false); setSelectedEvent(null); setShowAllEvents(false);
    setCheckItems([]); setShowCheckItems(false);
  };
  const openEdit = (a: SchAnnouncement) => {
    setEditing(a); setDate(a.date); setTitle(a.title); setContent(a.content);
    setImportant(a.important ?? false); setUrl(a.url ?? '');
    setSelectedEvent(a.linkedEventId ? (events.find(e => e.id === a.linkedEventId) ?? null) : null);
    const ci = (a.checkItems ?? []).map(i => ({ text: i.text, note: i.note ?? '' }));
    setCheckItems(ci);
    setShowCheckItems(ci.length > 0);
    setShowForm(true);
  };
  const handleSelectEvent = (ev: SchEvent) => {
    setSelectedEvent(ev);
    setDate(ev.date);
    const ms = ev.type === 'match' ? getMatches(ev) : [];
    const autoTitle = ev.type === 'match'
      ? (ms[0]?.opponentName ? `${ev.date.slice(5)} 🆚 ${ms[0].opponentName}${ms.length > 1 ? ` ほか${ms.length - 1}試合` : ''}のお知らせ` : `${ev.date.slice(5)} 試合のお知らせ`)
      : `${ev.date.slice(5)} ${ev.label || ev.location || tc(ev.type).label}のお知らせ`;
    setTitle(autoTitle);
  };
  const addCheckItem = () => setCheckItems(prev => [...prev, { text: '', note: '' }]);
  const removeCheckItem = (i: number) => setCheckItems(prev => prev.filter((_, idx) => idx !== i));
  const updateCheckItem = (i: number, field: 'text' | 'note', val: string) =>
    setCheckItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validCheckItems = checkItems.filter(i => i.text.trim());
    if (!title || (!content && !url && validCheckItems.length === 0)) return;
    const entry: SchAnnouncement = {
      id: editing?.id ?? generateId(), date, title, content, important,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      ...(url && { url }),
      ...(selectedEvent && { linkedEventId: selectedEvent.id }),
      ...(validCheckItems.length > 0 && {
        checkItems: validCheckItems.map(i => ({ text: i.text.trim(), ...(i.note.trim() && { note: i.note.trim() }) })),
      }),
    };
    // 新規は先頭に追加、編集は位置を保持
    const updated = editing ? announcements.map(a => a.id === editing.id ? entry : a) : [entry, ...announcements];
    onSave(updated);
    resetForm();
  };
  const handleDelete = (id: string) => { if (window.confirm('削除しますか？')) onSave(announcements.filter(a => a.id !== id)); };
  const sorted = [...announcements];

  return (
    <div className="space-y-3">
      <button onClick={() => setShowForm(true)} className="w-full bg-gradient-to-r from-purple-600 to-violet-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
        <span className="text-lg">＋</span> 連絡を投稿
      </button>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={resetForm}>
          <div className="bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-6 space-y-3">
              <div className="flex items-center justify-between"><h3 className="text-base font-bold text-white">{editing ? '連絡を編集' : '連絡を投稿'}</h3><button onClick={resetForm} className="text-slate-400 text-2xl">&times;</button></div>

              {/* 予定選択エリア */}
              {(() => {
                const upcoming = events
                  .filter(e => e.date >= todayStr())
                  .sort((a, b) => a.date.localeCompare(b.date));
                if (upcoming.length === 0) return null;
                return (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-2">📅 予定を選択して連絡に添付</p>
                    {selectedEvent ? (
                      <div className="relative">
                        <EventSummaryCard event={selectedEvent} />
                        <button
                          type="button"
                          onClick={() => setSelectedEvent(null)}
                          className="absolute top-2 right-2 text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none"
                        >✕</button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {(showAllEvents ? upcoming : upcoming.slice(0, 2)).map(ev => {
                          const ms = ev.type === 'match' ? getMatches(ev) : [];
                          const label = ev.type === 'match'
                            ? (ms[0]?.opponentName ? `${ev.date.slice(5)} 🆚 ${ms[0].opponentName}${ms.length > 1 ? ` ほか${ms.length - 1}試合` : ''}` : `${ev.date.slice(5)} 試合`)
                            : `${ev.date.slice(5)} ${ev.label || ev.location || tc(ev.type).label}`;
                          return (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={() => handleSelectEvent(ev)}
                              className="w-full text-left text-xs px-3 py-2 rounded-lg bg-slate-700/60 hover:bg-purple-700/40 border border-transparent hover:border-purple-500/50 text-slate-300 hover:text-white transition-colors flex items-center gap-2"
                            >
                              <span>{tc(ev.type).icon}</span>
                              <span className="truncate">{label}</span>
                            </button>
                          );
                        })}
                        {!showAllEvents && upcoming.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setShowAllEvents(true)}
                            className="w-full text-xs py-1.5 text-slate-500 hover:text-purple-400 transition-colors"
                          >
                            もっと見る（あと {upcoming.length - 2} 件）
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">📅 日付</label><input type="date" value={toInputDate(date)} onChange={e => setDate(fromInputDate(e.target.value))} required className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-purple-400 focus:outline-none" /></div>
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">📌 タイトル</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="例: 次回練習のお知らせ" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-purple-400 focus:outline-none placeholder-slate-500" /></div>
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">📝 コメント <span className="font-normal text-slate-500">（スケジュール・詳細など）</span></label><textarea value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder={"例:\n3/28（土）〜 3/30（月） 山梨合同遠征\n\n6:00 集合\n9:00 出発\n12:00 到着・昼食"} className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-purple-400 focus:outline-none placeholder-slate-500 resize-none" /></div>

                {/* 持ち物リスト */}
                <div>
                  <button
                    type="button"
                    onClick={() => { setShowCheckItems(v => !v); if (!showCheckItems && checkItems.length === 0) addCheckItem(); }}
                    className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors w-full ${showCheckItems ? 'bg-amber-900/30 border-amber-500/40 text-amber-300' : 'bg-slate-700/40 border-white/10 text-slate-400 hover:text-amber-300'}`}
                  >
                    <span>🎒</span>
                    <span>{showCheckItems ? '持ち物リストを閉じる' : '持ち物リストを追加'}</span>
                    {checkItems.filter(i => i.text.trim()).length > 0 && (
                      <span className="ml-auto text-[10px] bg-amber-600/40 text-amber-300 px-1.5 py-0.5 rounded-full">
                        {checkItems.filter(i => i.text.trim()).length}件
                      </span>
                    )}
                  </button>
                  {showCheckItems && (
                    <div className="mt-2 space-y-2 bg-slate-900/40 rounded-xl p-3 border border-amber-500/20">
                      {checkItems.map((item, i) => (
                        <div key={i} className="flex gap-1.5 items-center">
                          <span className="text-slate-500 text-xs w-4 text-center shrink-0">{i + 1}</span>
                          <input
                            type="text"
                            value={item.text}
                            onChange={e => updateCheckItem(i, 'text', e.target.value)}
                            placeholder="持ち物名"
                            className="flex-1 rounded-lg border border-slate-600 bg-slate-800 text-white px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none placeholder-slate-500"
                          />
                          <input
                            type="text"
                            value={item.note}
                            onChange={e => updateCheckItem(i, 'note', e.target.value)}
                            placeholder="備考"
                            className="w-20 rounded-lg border border-slate-600 bg-slate-800 text-white px-2 py-1.5 text-xs focus:border-amber-400 focus:outline-none placeholder-slate-500"
                          />
                          <button type="button" onClick={() => removeCheckItem(i)} className="text-slate-500 hover:text-red-400 text-sm px-1">✕</button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addCheckItem}
                        className="w-full text-xs py-1.5 text-amber-400/70 hover:text-amber-300 border border-dashed border-amber-500/30 rounded-lg transition-colors"
                      >
                        ＋ 項目を追加
                      </button>
                    </div>
                  )}
                </div>

                <div><label className="block text-xs font-semibold text-slate-400 mb-1">🔗 投稿URL <span className="font-normal text-slate-500">（Instagram リンク等）</span></label><input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.instagram.com/p/..." className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-purple-400 focus:outline-none placeholder-slate-500" /></div>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={important} onChange={e => setImportant(e.target.checked)} className="w-4 h-4 accent-red-500" /><span className="text-sm text-slate-300">🔴 重要な連絡としてマーク</span></label>
                <button type="submit" className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl text-sm">投稿</button>
              </form>
            </div>
          </div>
        </div>
      )}
      {sorted.length === 0 && <p className="text-center text-slate-400 text-sm py-8">連絡がありません</p>}
      <div className="space-y-2">
        {sorted.map(a => {
          const linkedEv = a.linkedEventId ? events.find(e => e.id === a.linkedEventId) : null;
          return (
            <div key={a.id} id={`announce-card-${a.id}`} className={`rounded-xl p-4 border ${a.important ? 'bg-red-900/20 border-red-500/40' : 'bg-slate-800/60 border-white/10'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">{a.important && <span className="text-xs font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">重要</span>}<span className="text-xs text-slate-400">{a.date}</span></div>
                  <p className="text-sm font-bold text-white">{a.title}</p>
                  {linkedEv && <div className="mt-2"><EventSummaryCard event={linkedEv} /></div>}
                  {a.content && <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{a.content}</p>}
                  {a.checkItems && a.checkItems.length > 0 && (
                    <CheckList items={a.checkItems} announcementId={a.id} />
                  )}
                  {a.url && isInstagramUrl(a.url) && <InstagramEmbed url={a.url} />}
                  {a.url && !isInstagramUrl(a.url) && <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 hover:underline mt-1 block truncate">{a.url}</a>}
                </div>
                <div className="flex flex-col gap-1"><button onClick={() => openEdit(a)} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700">編集</button><button onClick={() => handleDelete(a.id)} className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-slate-700">削除</button></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- MemberSection ----
function MemberSection({
  members, onSaveMember,
  nearbyParking, onSaveNearbyParking,
  parkingRotation, onResetRotation,
  teamLogo, onSaveTeamLogo,
}: {
  members: SchMember[];
  onSaveMember: (m: SchMember[]) => void;
  nearbyParking: SchNearbyParking[];
  onSaveNearbyParking: (p: SchNearbyParking[]) => void;
  parkingRotation: number;
  onResetRotation: (index: number) => void;
  teamLogo: string | null;
  onSaveTeamLogo: (logo: string | null) => void;
}) {
  const [viewingMember, setViewingMember] = useState<SchMember | null>(null);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editingMember, setEditingMember] = useState<SchMember | null>(null);
  const [mNumber, setMNumber] = useState('');
  const [mName, setMName] = useState('');
  const [mNameKana, setMNameKana] = useState('');
  const [mBirthDate, setMBirthDate] = useState('');
  const [mParents, setMParents] = useState<SchMemberParent[]>([]);

  const [showParkingForm, setShowParkingForm] = useState(false);
  const [editingParking, setEditingParking] = useState<SchNearbyParking | null>(null);
  const [pName, setPName] = useState('');
  const [pAddress, setPAddress] = useState('');
  const [pMapsUrl, setPMapsUrl] = useState('');
  const [pNote, setPNote] = useState('');

  const [logoWarning, setLogoWarning] = useState('');

  const resetMemberForm = () => { setMNumber(''); setMName(''); setMNameKana(''); setMBirthDate(''); setMParents([]); setEditingMember(null); setShowMemberForm(false); };
  const openEditMember = (m: SchMember) => { setEditingMember(m); setMNumber(String(m.number)); setMName(m.name); setMNameKana(m.nameKana ?? ''); setMBirthDate(m.birthDate ?? ''); setMParents(m.parents ? [...m.parents] : []); setShowMemberForm(true); };
  const handleMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mName || !mNumber) return;
    const entry: SchMember = {
      id: editingMember?.id ?? generateId(),
      number: Number(mNumber),
      name: mName,
      ...(mNameKana && { nameKana: mNameKana }),
      ...(mBirthDate && { birthDate: mBirthDate }),
      ...(mParents.length > 0 && { parents: mParents.filter(p => p.name.trim()) }),
    };
    const updated = editingMember ? members.map(m => m.id === editingMember.id ? entry : m) : [...members, entry];
    onSaveMember(updated.sort((a, b) => a.number - b.number));
    resetMemberForm();
  };
  const addParent = () => { if (mParents.length < 2) setMParents(prev => [...prev, { role: '父', name: '' }]); };
  const removeParent = (i: number) => setMParents(prev => prev.filter((_, idx) => idx !== i));
  const updateParent = (i: number, field: keyof SchMemberParent, val: string) =>
    setMParents(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  const deleteMember = (id: string) => { if (window.confirm('削除しますか？')) onSaveMember(members.filter(m => m.id !== id)); };

  const resetParkingForm = () => { setPName(''); setPAddress(''); setPMapsUrl(''); setPNote(''); setEditingParking(null); setShowParkingForm(false); };
  const openEditParking = (p: SchNearbyParking) => { setEditingParking(p); setPName(p.name); setPAddress(p.address ?? ''); setPMapsUrl(p.googleMapsUrl ?? ''); setPNote(p.note ?? ''); setShowParkingForm(true); };
  const handleParkingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName) return;
    const entry: SchNearbyParking = { id: editingParking?.id ?? generateId(), name: pName, address: pAddress || undefined, googleMapsUrl: pMapsUrl || undefined, note: pNote || undefined };
    const updated = editingParking ? nearbyParking.map(p => p.id === editingParking.id ? entry : p) : [...nearbyParking, entry];
    onSaveNearbyParking(updated);
    resetParkingForm();
  };
  const deleteParking = (id: string) => { if (window.confirm('削除しますか？')) onSaveNearbyParking(nearbyParking.filter(p => p.id !== id)); };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 300 * 1024) { setLogoWarning('ファイルサイズが大きすぎます（300KB以下推奨）'); return; }
    setLogoWarning('');
    const reader = new FileReader();
    reader.onload = () => onSaveTeamLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  const sorted = [...members].sort((a, b) => a.number - b.number);
  const nextMember = sorted[parkingRotation % Math.max(sorted.length, 1)];

  return (
    <div className="space-y-6">
      {/* Member list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">メンバー</h2>
          <button onClick={() => setShowMemberForm(true)} className="text-xs text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded-lg border border-blue-500/30 hover:border-blue-400/50">＋ 追加</button>
        </div>
        <p className="text-xs text-slate-500 mb-2">背番号順 ＝ 🅿️ 駐車場順</p>
        {sorted.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-4">メンバーが登録されていません</p>
        ) : (
          <div className="bg-slate-800/60 border border-white/10 rounded-xl overflow-hidden">
            {sorted.map((m, i) => (
              <div key={m.id} className={`flex items-center gap-3 px-4 py-3 ${i < sorted.length - 1 ? 'border-b border-white/5' : ''}`}>
                <span className="text-slate-500 text-xs w-5 text-right font-mono">{i + 1}</span>
                <span className="w-10 text-center text-sm font-extrabold text-blue-300 bg-blue-900/30 rounded-lg py-0.5">#{m.number}</span>
                <button onClick={() => setViewingMember(m)} className="flex-1 min-w-0 text-left">
                  {m.nameKana ? (
                    <>
                      <span className="text-white text-sm font-medium">{m.nameKana}</span>
                      <span className="text-slate-500 text-xs ml-1.5">（{m.name}）</span>
                    </>
                  ) : (
                    <span className="text-white text-sm font-medium">{m.name}</span>
                  )}
                </button>
                <div className="flex gap-1">
                  <button onClick={() => openEditMember(m)} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700">編集</button>
                  <button onClick={() => deleteMember(m.id)} className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-slate-700">削除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Parking rotation */}
      <div>
        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">🅿️ ローテーション管理</h2>
        <div className="bg-slate-800/60 border border-white/10 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-xs text-slate-400">次の割当開始</p>
            {nextMember ? (
              <p className="text-sm font-bold text-white mt-0.5">#{nextMember.number} {nextMember.nameKana || nextMember.name} から</p>
            ) : (
              <p className="text-sm text-slate-500 mt-0.5">メンバーなし</p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1.5">開始メンバーを変更</p>
            <div className="flex flex-wrap gap-1.5">
              {sorted.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => onResetRotation(i)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${parkingRotation % Math.max(sorted.length, 1) === i ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white'}`}
                >
                  #{m.number}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Nearby parking */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">🗺️ 近隣駐車場</h2>
          <button onClick={() => setShowParkingForm(true)} className="text-xs text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded-lg border border-blue-500/30 hover:border-blue-400/50">＋ 追加</button>
        </div>
        {nearbyParking.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-4">近隣駐車場が登録されていません</p>
        ) : (
          <div className="space-y-2">
            {nearbyParking.map(p => (
              <div key={p.id} className="bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{p.name}</p>
                    {p.address && <p className="text-xs text-slate-400 mt-0.5 truncate">📍 {p.address}</p>}
                    {p.note && <p className="text-xs text-slate-400 mt-0.5">📝 {p.note}</p>}
                    {p.googleMapsUrl && (
                      <a href={p.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-400 hover:text-blue-300">
                        🗺️ Google マップで開く
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => openEditParking(p)} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700">編集</button>
                    <button onClick={() => deleteParking(p.id)} className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-slate-700">削除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team logo */}
      <div>
        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">🏅 チームロゴ</h2>
        <div className="bg-slate-800/60 border border-white/10 rounded-xl p-4 space-y-3">
          {teamLogo ? (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={teamLogo} alt="チームロゴ" className="h-16 w-auto object-contain rounded-lg bg-white/5 p-1" />
              <div>
                <p className="text-xs text-slate-300 mb-1">カスタムロゴ使用中</p>
                <button
                  onClick={() => onSaveTeamLogo(null)}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-400/50 px-3 py-1 rounded-lg"
                >
                  削除してデフォルトに戻す
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">デフォルトのSCHロゴを使用中</p>
          )}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">ロゴ画像をアップロード（300KB以下推奨）</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-600 file:text-xs file:bg-slate-700 file:text-slate-300 hover:file:bg-slate-600"
            />
            {logoWarning && <p className="text-xs text-red-400 mt-1">{logoWarning}</p>}
          </div>
        </div>
      </div>

      {/* Member detail modal */}
      {viewingMember && (() => {
        const m = viewingMember;
        const age = m.birthDate ? (() => {
          const b = new Date(m.birthDate!);
          const today = new Date();
          let a = today.getFullYear() - b.getFullYear();
          if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) a--;
          return a;
        })() : null;
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setViewingMember(null)}>
            <div className="bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="px-5 pt-5 pb-6 space-y-4">
                {/* ヘッダー: 番号 + 閉じるボタン */}
                <div className="flex items-center justify-between">
                  <span className="text-xl font-extrabold text-blue-300 bg-blue-900/30 rounded-xl px-3 py-1">#{m.number}</span>
                  <button onClick={() => setViewingMember(null)} className="text-slate-400 text-2xl">&times;</button>
                </div>
                {/* 本人情報メイン */}
                <div className="space-y-1">
                  {m.nameKana ? (
                    <>
                      <p className="text-2xl font-extrabold text-white">{m.nameKana}</p>
                      <p className="text-sm text-slate-400">{m.name}</p>
                    </>
                  ) : (
                    <p className="text-2xl font-extrabold text-white">{m.name}</p>
                  )}
                  {m.birthDate && (
                    <p className="text-sm text-slate-300 pt-1">
                      🎂 {m.birthDate.replace(/-/g, '/')}生まれ
                      {age !== null && <span className="text-slate-500 text-xs ml-2">（{age}歳）</span>}
                    </p>
                  )}
                </div>
                {/* 保護者（サブ情報） */}
                {m.parents && m.parents.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-t border-white/10 pt-3">保護者</p>
                    {m.parents.map((p, i) => (
                      <div key={i} className="flex items-start gap-3 bg-slate-700/40 rounded-xl px-4 py-2.5">
                        <span className="text-lg mt-0.5">{p.role === '父' ? '👨' : p.role === '母' ? '👩' : '👤'}</span>
                        <div>
                          <p className="text-[10px] text-slate-500">{p.role}</p>
                          <p className="text-sm text-white">{p.name}</p>
                          {p.nameKana && <p className="text-xs text-slate-400">{p.nameKana}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!m.birthDate && (!m.parents || m.parents.length === 0) && (
                  <p className="text-sm text-slate-500 text-center py-2">詳細情報なし</p>
                )}
                <button onClick={() => { setViewingMember(null); openEditMember(m); }} className="w-full text-xs text-slate-400 border border-slate-600 hover:border-slate-400 hover:text-white py-2 rounded-xl transition-colors">編集</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Member form modal */}
      {showMemberForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={resetMemberForm}>
          <div className="bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-6 space-y-3">
              <div className="flex items-center justify-between"><h3 className="text-base font-bold text-white">{editingMember ? 'メンバーを編集' : 'メンバーを追加'}</h3><button onClick={resetMemberForm} className="text-slate-400 text-2xl">&times;</button></div>
              <form onSubmit={handleMemberSubmit} className="space-y-3">
                <div><label className="block text-xs font-semibold text-slate-400 mb-1"># 背番号</label><input type="number" min="1" max="99" value={mNumber} onChange={e => setMNumber(e.target.value)} required className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none" /></div>
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">👤 名前（漢字）</label><input type="text" value={mName} onChange={e => setMName(e.target.value)} required placeholder="例: 西本拓渡" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none placeholder-slate-500" /></div>
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">📖 ふりがな</label><input type="text" value={mNameKana} onChange={e => setMNameKana(e.target.value)} placeholder="例: にしもとたくと" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none placeholder-slate-500" /></div>
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">🎂 生年月日</label><input type="date" value={mBirthDate} onChange={e => setMBirthDate(e.target.value)} className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none" /></div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-400">👨‍👩‍👦 保護者</label>
                    {mParents.length < 2 && <button type="button" onClick={addParent} className="text-xs text-blue-400 hover:text-blue-300">＋ 追加</button>}
                  </div>
                  <div className="space-y-2">
                    {mParents.map((p, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex gap-2 items-center">
                          <select value={p.role} onChange={e => updateParent(i, 'role', e.target.value)} className="rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-2 text-xs focus:border-blue-400 focus:outline-none w-20">
                            <option>父</option><option>母</option><option>その他</option>
                          </select>
                          <input type="text" value={p.name} onChange={e => updateParent(i, 'name', e.target.value)} placeholder="氏名" className="flex-1 rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none placeholder-slate-500" />
                          <button type="button" onClick={() => removeParent(i)} className="text-slate-400 hover:text-red-400 text-lg px-1">×</button>
                        </div>
                        <input type="text" value={p.nameKana ?? ''} onChange={e => updateParent(i, 'nameKana', e.target.value)} placeholder="よみがな（任意）" className="w-full rounded-xl border border-slate-600 bg-slate-900 text-white px-3 py-1.5 text-xs focus:border-blue-400 focus:outline-none placeholder-slate-500" />
                      </div>
                    ))}
                    {mParents.length === 0 && <p className="text-xs text-slate-500">保護者情報なし</p>}
                  </div>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm">保存</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Nearby parking form modal */}
      {showParkingForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={resetParkingForm}>
          <div className="bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-6 space-y-3">
              <div className="flex items-center justify-between"><h3 className="text-base font-bold text-white">{editingParking ? '駐車場を編集' : '近隣駐車場を追加'}</h3><button onClick={resetParkingForm} className="text-slate-400 text-2xl">&times;</button></div>
              <form onSubmit={handleParkingSubmit} className="space-y-3">
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">🅿️ 名前</label><input type="text" value={pName} onChange={e => setPName(e.target.value)} required placeholder="例: ○○コインパーキング" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none placeholder-slate-500" /></div>
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">📍 住所</label><input type="text" value={pAddress} onChange={e => setPAddress(e.target.value)} placeholder="例: 横浜市○○区..." className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none placeholder-slate-500" /></div>
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">🗺️ Google マップ URL</label><input type="url" value={pMapsUrl} onChange={e => setPMapsUrl(e.target.value)} placeholder="https://maps.google.com/..." className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none placeholder-slate-500" /></div>
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">📝 メモ</label><input type="text" value={pNote} onChange={e => setPNote(e.target.value)} placeholder="料金・台数など" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none placeholder-slate-500" /></div>
                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm">保存</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main Page ----
type Tab = 'home' | 'events' | 'stats' | 'announce' | 'member';

/** Base64URL文字列 → ArrayBuffer（iOS Safariは文字列キーを受け付けないため必須） */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr.buffer;
}

export default function SchPage() {
  const [tab, setTab] = useState<Tab>('home');
  const [events, setEvents] = useState<SchEvent[]>([]);
  const [announcements, setAnnouncements] = useState<SchAnnouncement[]>([]);
  const [members, setMembers] = useState<SchMember[]>([]);
  const [parkingRecords, setParkingRecords] = useState<SchParkingRecord[]>([]);
  const [parkingRotation, setParkingRotation] = useState(5);
  const [nearbyParking, setNearbyParking] = useState<SchNearbyParking[]>([]);
  const [teamLogo, setTeamLogo] = useState<string | null>(null);
  const [updateHistory, setUpdateHistory] = useState<SchUpdateHistory[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [scrollTarget, setScrollTarget] = useState<{ tab: Tab; itemId: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pushState, setPushState] = useState<'loading' | 'unsupported' | 'default' | 'subscribed' | 'denied'>('loading');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  // 編集履歴モーダル
  interface HistoryModal { editEntries: SchUpdateHistory[]; autoEntries: SchUpdateHistory[]; baseHistory: SchUpdateHistory[]; memo: string; previousEvents?: SchEvent[]; previousAnnouncements?: SchAnnouncement[]; }
  const [historyModal, setHistoryModal] = useState<HistoryModal | null>(null);

  useEffect(() => {
    fetch('/api/admin/logs?limit=1').then(r => { if (r.ok) setIsAdmin(true); }).catch(() => {});
  }, []);

  // scrollTarget: タブ切替後にスクロール
  useEffect(() => {
    if (!scrollTarget) return;
    const timer = setTimeout(() => {
      const prefix = scrollTarget.tab === 'events' ? 'event-card' : 'announce-card';
      const el = document.getElementById(`${prefix}-${scrollTarget.itemId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setScrollTarget(null);
    }, 120);
    return () => clearTimeout(timer);
  }, [scrollTarget]);

  // Web Push: 初期状態を確認
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushState('unsupported');
      return;
    }
    // iOS Safari: PWA（ホーム画面追加）でないとWeb Push不可
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isIOSPWA = (navigator as any).standalone === true;
    if (isIOS && !isIOSPWA) {
      setPushState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') { setPushState('denied'); return; }
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setPushState(sub ? 'subscribed' : 'default');
    }).catch(() => setPushState('unsupported'));
  }, []);

  const handlePushToggle = useCallback(async () => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushError(null);
    try {
      if (pushState === 'subscribed') {
        // 解除
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch('/api/sch/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
          await sub.unsubscribe().catch(() => {});
        }
        setPushState('default');
      } else {
        // 購読: 権限確認
        let perm = Notification.permission;
        if (perm === 'default') {
          perm = await Notification.requestPermission();
        }
        if (perm === 'denied') { setPushState('denied'); return; }
        if (perm !== 'granted') { setPushError('通知が許可されませんでした'); return; }

        const keyRes = await fetch('/api/sch/push');
        if (!keyRes.ok) { setPushError(`サーバーエラー: ${keyRes.status}`); return; }
        const { publicKey } = await keyRes.json();
        if (!publicKey) { setPushError('VAPIDキー未設定'); return; }

        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) await existing.unsubscribe().catch(() => {});

        let sub;
        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        } catch (e2) {
          setPushError(`購読失敗: ${e2 instanceof Error ? e2.message : String(e2)}`);
          return;
        }

        const saveRes = await fetch('/api/sch/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
        if (!saveRes.ok) { setPushError(`登録失敗: ${saveRes.status}`); return; }
        setPushState('subscribed');
      }
    } catch (e) {
      setPushError(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPushBusy(false);
    }
  }, [pushState, pushBusy]);

  useEffect(() => {
    fetch('/api/sch').then(r => r.json()).then(d => {
      setEvents(d.events ?? []);
      setAnnouncements(d.announcements ?? []);
      setMembers(d.members ?? []);
      setParkingRecords(d.parkingRecords ?? []);
      setParkingRotation(d.parkingRotation ?? 5);
      setNearbyParking(d.nearbyParking ?? []);
      setTeamLogo(d.teamLogo ?? null);
      setUpdateHistory(d.updateHistory ?? []);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  const post = useCallback((body: object) => {
    fetch('/api/sch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(console.error);
  }, []);

  const saveEvents = useCallback((e: SchEvent[]) => {
    setEvents(e);
    post({ events: e });
    const oldMap = new Map(events.map(ev => [ev.id, ev]));
    const getEvTitle = (ev: SchEvent) => {
      if (ev.type === 'match') { const opp = ev.matches?.[0]?.opponentName || ev.opponentName; return opp ? `vs ${opp}` : '試合'; }
      return ev.label || ev.location || tc(ev.type).label;
    };
    const autoEntries: SchUpdateHistory[] = [];
    const editEntries: SchUpdateHistory[] = [];
    for (const ev of e) {
      const old = oldMap.get(ev.id);
      if (!old) autoEntries.push({ id: generateId(), timestamp: new Date().toISOString(), type: 'event', eventType: ev.type, title: getEvTitle(ev), action: 'new', itemId: ev.id, tab: 'events' });
      else if (JSON.stringify(old) !== JSON.stringify(ev)) editEntries.push({ id: generateId(), timestamp: new Date().toISOString(), type: 'event', eventType: ev.type, title: getEvTitle(ev), action: 'edit', itemId: ev.id, tab: 'events' });
    }
    if (editEntries.length > 0) {
      setHistoryModal({ editEntries, autoEntries, baseHistory: updateHistory, memo: '', previousEvents: events });
    } else if (autoEntries.length > 0) {
      const h = [...autoEntries, ...updateHistory].slice(0, 20);
      setUpdateHistory(h); post({ updateHistory: h });
    }
  }, [post, events, updateHistory]);

  const saveAnnounce = useCallback((a: SchAnnouncement[]) => {
    setAnnouncements(a);
    post({ announcements: a });
    const oldMap = new Map(announcements.map(ann => [ann.id, ann]));
    const autoEntries: SchUpdateHistory[] = [];
    const editEntries: SchUpdateHistory[] = [];
    for (const ann of a) {
      const old = oldMap.get(ann.id);
      if (!old) autoEntries.push({ id: generateId(), timestamp: new Date().toISOString(), type: 'announcement', title: ann.title, action: 'new', itemId: ann.id, tab: 'announce' });
      else if (JSON.stringify(old) !== JSON.stringify(ann)) editEntries.push({ id: generateId(), timestamp: new Date().toISOString(), type: 'announcement', title: ann.title, action: 'edit', itemId: ann.id, tab: 'announce' });
    }
    if (editEntries.length > 0) {
      setHistoryModal({ editEntries, autoEntries, baseHistory: updateHistory, memo: '', previousAnnouncements: announcements });
    } else if (autoEntries.length > 0) {
      const h = [...autoEntries, ...updateHistory].slice(0, 20);
      setUpdateHistory(h); post({ updateHistory: h });
    }
  }, [post, announcements, updateHistory]);
  const saveMembers      = useCallback((m: SchMember[])       => { setMembers(m);      post({ members: m }); }, [post]);
  const saveNearby       = useCallback((p: SchNearbyParking[])=> { setNearbyParking(p);post({ nearbyParking: p }); }, [post]);
  const saveRotation     = useCallback((i: number)            => { setParkingRotation(i); post({ parkingRotation: i }); }, [post]);
  const saveRecords      = useCallback((r: SchParkingRecord[])=> { setParkingRecords(r); post({ parkingRecords: r }); }, [post]);
  const saveTeamLogo     = useCallback((logo: string | null)  => { setTeamLogo(logo);  post({ teamLogo: logo }); }, [post]);

  const upsertParkingRecord = useCallback((eventId: string, updater: (slots: SchParkingSlot[]) => SchParkingSlot[]) => {
    setParkingRecords(prev => {
      const existing = prev.find(r => r.eventId === eventId);
      let updated: SchParkingRecord[];
      if (existing) {
        updated = prev.map(r => r.eventId === eventId ? { ...r, slots: updater(r.slots) } : r);
      } else {
        const event = events.find(e => e.id === eventId);
        if (!event) return prev;
        const newRecord: SchParkingRecord = {
          eventId, eventDate: event.date,
          eventType: event.type,
          slots: updater([]),
          rotationStartIndex: 0,
        };
        updated = [...prev, newRecord];
      }
      post({ parkingRecords: updated });
      return updated;
    });
  }, [events, post]);

  const handleSkip = useCallback((eventId: string, memberId: string, comment: string) => {
    upsertParkingRecord(eventId, slots => {
      const without = slots.filter(s => s.memberId !== memberId);
      return [...without, { memberId, status: 'skipped', skipComment: comment }];
    });
  }, [upsertParkingRecord]);

  const handleUnskip = useCallback((eventId: string, memberId: string) => {
    upsertParkingRecord(eventId, slots => slots.filter(s => s.memberId !== memberId));
  }, [upsertParkingRecord]);

  const handleMarkUsed = useCallback((eventId: string, memberId: string) => {
    upsertParkingRecord(eventId, slots => {
      const without = slots.filter(s => s.memberId !== memberId);
      return [...without, { memberId, status: 'used' }];
    });
  }, [upsertParkingRecord]);

  const handleMarkPending = useCallback((eventId: string, memberId: string) => {
    upsertParkingRecord(eventId, slots => {
      const without = slots.filter(s => s.memberId !== memberId);
      return [...without, { memberId, status: 'pending' }];
    });
  }, [upsertParkingRecord]);

  const handleSaveFullRecord = useCallback((eventId: string, slots: SchParkingSlot[]) => {
    upsertParkingRecord(eventId, () => slots);
  }, [upsertParkingRecord]);

  const handleUpdateMaxSlots = useCallback((eventId: string, maxSlots: number) => {
    setEvents(prev => {
      const updated = prev.map(e => e.id === eventId ? { ...e, maxParkingSlots: maxSlots } : e);
      post({ events: updated });
      return updated;
    });
  }, [post]);


  const tabs = [
    { key: 'home'    as Tab, label: 'ホーム',   icon: '🏠' },
    { key: 'events'  as Tab, label: '予定',     icon: '📅' },
    { key: 'stats'   as Tab, label: '戦績',     icon: '🏆' },
    { key: 'announce'as Tab, label: '連絡',     icon: '📢' },
    { key: 'member'  as Tab, label: 'メンバー', icon: '🪪' },
  ];

  const logoSrc = teamLogo ?? '/sch-logo.png';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <div className="text-center"><p className="text-4xl mb-3">⚽</p><p className="text-sm">読み込み中...</p></div>
      </div>
    );
  }

  return (
    <>
      <header className="mb-5 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {teamLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt="SCH FC" className="object-contain h-14 w-auto" />
            ) : (
              <Image src="/sch-logo.png" alt="SCH FC" width={175} height={215} className="object-contain h-14 w-auto" />
            )}
            <h1 className="text-2xl font-extrabold text-white drop-shadow">SCH Info</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] text-white/20 select-none">{process.env.NEXT_PUBLIC_BUILD_TIME}</span>
            <div className="flex items-center gap-1.5">
              {pushState === 'loading' ? null
                : pushState === 'unsupported'
                ? (() => {
                    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
                    return isIOS ? (
                      <span className="text-[9px] text-slate-500 text-right leading-tight">
                        ホーム画面に追加<br />すると通知が使えます
                      </span>
                    ) : null;
                  })()
                : (
                <button
                  onClick={handlePushToggle}
                  className={`text-[11px] whitespace-nowrap border px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                    pushBusy
                      ? 'text-slate-500 border-slate-700 cursor-wait opacity-60'
                      : pushState === 'subscribed'
                      ? 'text-white bg-green-700 border-green-600 active:bg-red-800 active:border-red-600'
                      : pushState === 'denied'
                      ? 'text-slate-500 border-slate-700 cursor-not-allowed opacity-50'
                      : 'text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-500'
                  }`}
                  title={pushState === 'subscribed' ? '通知ON（タップでOFF）' : pushState === 'denied' ? 'ブラウザの設定から通知を許可してください' : '通知OFF（タップでON）'}
                  disabled={pushState === 'denied' || pushBusy}
                >
                  {pushBusy
                    ? <span className="text-[10px]">…</span>
                    : pushState === 'subscribed'
                    ? <><span>🔔</span><span className="text-[9px]">通知</span></>
                    : <><span>🔕</span><span className="text-[9px]">通知</span></>
                  }
                </button>
              )}
              {pushError && (
                <span className="text-[9px] text-red-400 max-w-[120px] text-right leading-tight break-all">{pushError}</span>
              )}
              <button
                onClick={() => {
                  const calUrl = 'https://soccer-trianing.vercel.app/api/sch/calendar';
                  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                  if (isIOS) {
                    window.location.href = calUrl.replace('https://', 'webcal://');
                  } else {
                    window.open(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent('webcal://soccer-trianing.vercel.app/api/sch/calendar')}`, '_blank');
                  }
                }}
                className="text-[10px] whitespace-nowrap text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 px-2.5 py-1 rounded-lg transition-colors"
                title="予定をカレンダーに追加"
              >
                📅 カレンダー追加
              </button>
              {isAdmin && (
                <a
                  href="/sch/admin"
                  className="text-[10px] whitespace-nowrap text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 px-2.5 py-1 rounded-lg transition-colors"
                >
                  🔍 管理
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Link href="/sch/history" className="flex items-center gap-1.5 text-[10px] text-slate-300 hover:text-white border border-slate-600 hover:border-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
            🏆 戦歴
          </Link>
          <Link href="/sch/ob" className="flex items-center gap-1.5 text-[10px] text-slate-300 hover:text-white border border-slate-600 hover:border-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
            ⚽ OB進路
          </Link>
          <Link href="/sch/kanagawa" className="flex items-center gap-1.5 text-[10px] text-slate-300 hover:text-white border border-slate-600 hover:border-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
            📊 神奈川県推移
          </Link>
        </div>
      </header>

      <div className="flex bg-slate-800/60 rounded-xl p-1 mb-5 border border-white/10">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg transition-all ${tab === key ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-300'}`}
          >
            <span className="text-base leading-tight">{icon}</span>
            <span className="text-[9px] font-semibold leading-tight mt-0.5">{label}</span>
          </button>
        ))}
      </div>

      {tab === 'home' && updateHistory.length > 0 && (() => {
        const latest = updateHistory[0];
        const latestTs = new Date(latest.timestamp);
        const mm = latestTs.getMonth() + 1;
        const dd = latestTs.getDate();
        const hh = latestTs.getHours().toString().padStart(2, '0');
        const min = latestTs.getMinutes().toString().padStart(2, '0');
        const histItems = updateHistory.slice(0, 5);
        const typeIcon = (h: SchUpdateHistory) => {
          if (h.type === 'announcement') return '📢';
          const icons: Record<string, string> = { match: '🏆', practice: '⚽', camp: '🏕️', expedition: '🚌', other: '📅' };
          return icons[h.eventType ?? ''] ?? '📅';
        };
        const itemTs = (h: SchUpdateHistory) => {
          const t = new Date(h.timestamp);
          return `${t.getMonth() + 1}/${t.getDate()} ${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}`;
        };
        return (
          <div className="mb-4 rounded-2xl bg-slate-800/70 border border-white/10 overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
              onClick={() => setHistoryOpen(o => !o)}
            >
              <span className="text-lg">🔔</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white leading-tight">
                  {mm}月{dd}日 {hh}:{min} に更新がありました
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{latest.action === 'new' ? '新規投稿' : '編集'}：{latest.title}</p>
              </div>
              <span className="text-slate-400 text-xs font-bold transition-transform" style={{ display: 'inline-block', transform: historyOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
            </button>
            {historyOpen && (
              <div className="border-t border-white/10">
                <p className="text-[10px] text-slate-500 px-4 pt-2 pb-1 font-bold uppercase tracking-wider">過去 {histItems.length} 件の更新</p>
                {histItems.map(h => (
                  <button
                    key={h.id}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 active:bg-white/10 transition-colors border-t border-white/5 text-left"
                    onClick={() => { setHistoryOpen(false); setTab(h.tab); setScrollTarget({ tab: h.tab, itemId: h.itemId }); }}
                  >
                    <span className="text-base w-5 flex-shrink-0 text-center">{typeIcon(h)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-semibold truncate">{h.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        <span className={`font-bold mr-1.5 ${h.action === 'new' ? 'text-emerald-400' : 'text-amber-400'}`}>{h.action === 'new' ? '新規' : '編集'}</span>
                        {h.changeMemo && <span className="text-slate-300 mr-1.5">「{h.changeMemo}」</span>}
                        {itemTs(h)}
                      </p>
                    </div>
                    <span className="text-slate-500 text-xs">›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* 編集履歴モーダル */}
      {historyModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-md bg-slate-800 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="px-5 pt-5 pb-3">
              <p className="text-sm font-bold text-white mb-0.5">更新履歴に追記しますか？</p>
              <p className="text-[11px] text-slate-400 mb-4">
                {historyModal.editEntries.map(e => `「${e.title}」`).join('・')} を編集しました
              </p>
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5">変更内容のメモ（例: 備考を修正、集合時間を変更）</label>
              <input
                type="text"
                value={historyModal.memo}
                onChange={e => setHistoryModal(m => m ? { ...m, memo: e.target.value } : m)}
                placeholder="省略可"
                className="w-full rounded-xl bg-slate-900 border border-slate-600 text-white text-sm px-3 py-2.5 focus:border-purple-400 focus:outline-none placeholder-slate-500"
                autoFocus
              />
            </div>
            <div className="border-t border-white/10">
              <div className="flex">
                <button
                  className="flex-1 py-3 text-sm font-semibold text-slate-200 hover:bg-white/5 transition-colors border-r border-white/10"
                  onClick={() => {
                    // 編集のみ保存：autoEntries だけ履歴に追加
                    const { autoEntries, baseHistory } = historyModal;
                    if (autoEntries.length > 0) { const h = [...autoEntries, ...baseHistory].slice(0, 20); setUpdateHistory(h); post({ updateHistory: h }); }
                    setHistoryModal(null);
                  }}
                >編集のみ保存</button>
                <button
                  className="flex-1 py-3 text-sm font-bold text-white bg-purple-600/30 hover:bg-purple-600/50 transition-colors"
                  onClick={() => {
                    const { editEntries, autoEntries, baseHistory, memo } = historyModal;
                    const withMemo = editEntries.map(e => ({ ...e, ...(memo.trim() ? { changeMemo: memo.trim() } : {}) }));
                    const h = [...withMemo, ...autoEntries, ...baseHistory].slice(0, 20);
                    setUpdateHistory(h); post({ updateHistory: h });
                    setHistoryModal(null);
                  }}
                >更新を通知する</button>
              </div>
              <div className="flex justify-center border-t border-white/5 py-2">
                <button
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-4 py-1"
                  onClick={() => {
                    // 戻る：編集をリバート
                    const { previousEvents, previousAnnouncements } = historyModal;
                    if (previousEvents) { setEvents(previousEvents); post({ events: previousEvents }); }
                    if (previousAnnouncements) { setAnnouncements(previousAnnouncements); post({ announcements: previousAnnouncements }); }
                    setHistoryModal(null);
                  }}
                >戻る（編集を取り消す）</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'home' && (
        <HomeSection
          events={events} members={members}
          parkingRecords={parkingRecords} parkingRotation={parkingRotation}
          nearbyParking={nearbyParking}
          announcements={announcements} onGoToAnnounce={() => setTab('announce')}
          onSkip={handleSkip} onUnskip={handleUnskip} onMarkUsed={handleMarkUsed} onMarkPending={handleMarkPending}
          onSaveHistory={handleSaveFullRecord}
          onUpdateMaxSlots={handleUpdateMaxSlots}
        />
      )}
      {tab === 'events' && (
        <EventSection events={events} members={members} onSave={saveEvents} />
      )}
      {tab === 'stats' && (
        <StatsSection events={events} members={members} />
      )}
      {tab === 'announce' && (
        <AnnounceSection announcements={announcements} onSave={saveAnnounce} events={events} />
      )}
      {tab === 'member' && (
        <MemberSection
          members={members} onSaveMember={saveMembers}
          nearbyParking={nearbyParking} onSaveNearbyParking={saveNearby}
          parkingRotation={parkingRotation} onResetRotation={saveRotation}
          teamLogo={teamLogo} onSaveTeamLogo={saveTeamLogo}
        />
      )}
    </>
  );
}
