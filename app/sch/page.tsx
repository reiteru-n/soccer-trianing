'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  SchEvent, SchEventType, SchMatchType, SchMatchFormat, SchScorer, SchMatch,
  SchAnnouncement, SchMember, SchMemberParent, SchParkingRecord, SchParkingSlot, SchNearbyParking,
  SchUpdateHistory, SchParkingComment, SchParkingCommentType, SchStandaloneVideo,
} from '@/lib/types';
import { HouseIcon, CalendarIcon, VideoIcon, TrophyIcon, BellIcon, PeopleIcon, EditIcon } from '@/components/AppIcons';

// ---- Utilities ----
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}
// 終了日が今日より前なら「過去」とみなす（同日イベントは日付が変わるまで表示）
function isEventPast(event: { date: string; endDate?: string }): boolean {
  const today = todayStr();
  const endDate = event.endDate ?? event.date;
  return endDate < today;
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
  match:      { label: '試合',   icon: '🏆', badge: 'bg-blue-600/40 text-blue-300',    border: 'border-blue-500/30',   bg: 'bg-blue-900/20'   },
  camp:       { label: '合宿/遠征', icon: '🏕️', badge: 'bg-amber-600/40 text-amber-300', border: 'border-amber-500/30', bg: 'bg-amber-900/20' },
  expedition: { label: '合宿/遠征', icon: '🏕️', badge: 'bg-amber-600/40 text-amber-300', border: 'border-amber-500/30', bg: 'bg-amber-900/20' },
  other:      { label: 'その他', icon: '📌', badge: 'bg-slate-600/40 text-slate-300',  border: 'border-slate-500/30',  bg: 'bg-slate-800/40'  },
  off:        { label: 'OFF',   icon: '🏖️', badge: 'bg-red-600/40 text-red-300',      border: 'border-red-500/30',    bg: 'bg-red-900/20'    },
};
function tc(type: string): TypeCfg { return TYPE_CFG[type] ?? TYPE_CFG.other; }
// WMO天気コード (Open-Meteo) + 降水確率で判定
function weatherEmoji(code: number, precip: number): string {
  if (code >= 95) return '⛈️';                        // 雷雨
  if (code >= 71 && code <= 77) return '🌨️';          // 雪
  if (code >= 61 && precip >= 50) return '🌧️';        // 雨（確率高め）
  if (code >= 51 || (code >= 61 && precip < 50)) return '🌦️'; // 霧雨・小雨
  if (code >= 80 && code <= 82) return '🌦️';          // にわか雨
  if (code >= 45) return '🌫️';                        // 霧
  if (code >= 3) return '☁️';                         // 曇り
  if (code >= 1) return '⛅';                          // 晴れ時々曇り
  return '☀️';
}
function weatherLabel(code: number, precip: number): string {
  if (code >= 95) return '雷雨';
  if (code >= 71 && code <= 77) return '雪';
  if (code >= 61 && precip >= 50) return '雨';
  if (code >= 51 || (code >= 61 && precip < 50)) return '小雨';
  if (code >= 80 && code <= 82) return 'にわか雨';
  if (code >= 45) return '霧';
  if (code >= 3) return '曇り';
  if (code >= 1) return '晴れ';
  return '快晴';
}
// Calendar dot colors per event type
const EVENT_DOT: Record<string, string> = {
  practice: 'bg-green-400', schedule: 'bg-green-400',
  match: 'bg-blue-400',
  camp: 'bg-amber-400', expedition: 'bg-amber-400',
  other: 'bg-slate-400',
  off:   'bg-red-400',
};

const MATCH_TYPES: SchMatchType[] = ['公式戦', 'CUP戦', 'トレマ', 'その他'];
const MATCH_FORMATS: { value: SchMatchFormat; label: string }[] = [
  { value: 'friendly',          label: 'フレンドリー' },
  { value: 'tournament',        label: 'トーナメント' },
  { value: 'league_tournament', label: '予選+決勝T' },
];
const DEFAULT_MAX_SLOTS = 4;

const COMMENT_TYPE_CFG: Record<SchParkingCommentType, { label: string; icon: string; color: string }> = {
  skip_request: { label: 'スキップしたい',   icon: '⏭️', color: 'bg-amber-900/30 text-amber-300 border-amber-500/40' },
  want_slot:    { label: '使わせて欲しい',   icon: '🙋', color: 'bg-blue-900/30 text-blue-300 border-blue-500/40' },
  order_issue:  { label: '順番の不具合かも', icon: '⚠️', color: 'bg-red-900/30 text-red-300 border-red-500/40' },
  other:        { label: 'その他',           icon: '💬', color: 'bg-slate-700/50 text-slate-300 border-slate-600/50' },
};

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
  videoUrls: string[];
};
function emptyMatchState(): MatchFormState {
  return { id: generateId(), opponentName: '', roundName: '', dayNumber: '1', isHome: true, homeScore: '', awayScore: '', htHome: '', htAway: '', hasExtraTime: false, etHome: '', etAway: '', hasPK: false, pkHome: '', pkAway: '', scorers: [], assists: [], memo: '', videoUrls: [] };
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
    videoUrls: m.videoUrls ?? (m.videoUrl ? [m.videoUrl] : []),
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
    videoUrls: s.videoUrls.length > 0 ? s.videoUrls.filter(u => u.trim()) : undefined,
  };
}

// ---- MatchEntry (1試合分の入力フォーム) ----
function MatchEntry({
  value, onChange, onRemove, members, index, isMultiDay, dayCount, pastOpponents,
}: {
  value: MatchFormState;
  onChange: (updated: MatchFormState) => void;
  onRemove?: () => void;
  members: SchMember[];
  index: number;
  isMultiDay: boolean;
  dayCount: number;
  pastOpponents?: string[];
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
  const hasDetail = !!(value.scorers.length || value.assists.length || value.hasPK || value.hasExtraTime || value.htHome || value.htAway || value.memo);

  return (
    <div className="border border-slate-600/50 rounded-xl p-3 space-y-3 bg-slate-800/30">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-red-300">試合 {index + 1}</p>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-xs text-slate-500 hover:text-red-400 px-2 py-0.5 rounded hover:bg-slate-700">× 削除</button>
        )}
      </div>

      {/* 相手チーム */}
      <div>
        <label className={labelCls}>🆚 相手チーム</label>
        <SuggestInput value={value.opponentName} onChange={v => upd({ opponentName: v })} suggestions={pastOpponents ?? []} placeholder="例: ○○FC" className={inputCls} />
      </div>

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
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={value.homeScore} onChange={e => upd({ homeScore: e.target.value })} placeholder="-" className="w-16 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-2 text-lg font-bold text-center focus:border-red-400 focus:outline-none" />
          <span className="text-slate-400 font-bold text-lg">−</span>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={value.awayScore} onChange={e => upd({ awayScore: e.target.value })} placeholder="-" className="w-16 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-2 text-lg font-bold text-center focus:border-red-400 focus:outline-none" />
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
          <div><label className={labelCls}>💬 メモ</label><textarea value={value.memo} onChange={e => upd({ memo: e.target.value })} placeholder="試合の感想・特記事項など" rows={3} className={inputCls + ' resize-none'} /></div>
        </div>
      </details>

      {/* 動画URL — 複数登録可 */}
      <div>
        <label className={labelCls}>🎬 動画URL（BAND / YouTube など）</label>
        <div className="space-y-1.5">
          {(value.videoUrls.length === 0 ? [''] : value.videoUrls).map((url, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                type="url"
                value={url}
                onChange={e => {
                  const next = [...(value.videoUrls.length === 0 ? [''] : value.videoUrls)];
                  next[i] = e.target.value;
                  upd({ videoUrls: next });
                }}
                placeholder="https://..."
                className={inputCls + ' flex-1'}
              />
              {value.videoUrls.length > 1 && (
                <button
                  type="button"
                  onClick={() => upd({ videoUrls: value.videoUrls.filter((_, j) => j !== i) })}
                  className="text-slate-400 hover:text-red-400 text-lg leading-none px-1"
                >×</button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => upd({ videoUrls: [...value.videoUrls, ''] })}
            className="text-xs text-blue-400 hover:text-blue-300 mt-0.5"
          >＋ URLを追加</button>
        </div>
      </div>
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
  plan, members, isAdmin, onSkip, onUnskip, onMarkUsed, onUpdateMaxSlots,
}: {
  plan: EventPlan;
  members: SchMember[];
  isAdmin?: boolean;
  onSkip: (eventId: string, memberId: string, comment: string) => void;
  onUnskip: (eventId: string, memberId: string) => void;
  onMarkUsed: (eventId: string, memberId: string) => void;
  onUpdateMaxSlots: (eventId: string, maxSlots: number) => void;
}) {
  const [skipTarget, setSkipTarget] = useState<string | null>(null);
  const [skipComment, setSkipComment] = useState('');
  const [editingSlots, setEditingSlots] = useState(false);
  const [editMode, setEditMode] = useState(false);
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
        {isAdmin && editingSlots ? (
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
          <div className="flex items-center gap-1">
            {isAdmin ? (
              <button onClick={() => { setEditingSlots(true); setSlotsInput(String(plan.maxSlots)); }} className="text-[10px] text-slate-500 hover:text-slate-300 whitespace-nowrap">
                🅿️ {plan.maxSlots}台
              </button>
            ) : (
              <span className="text-[10px] text-slate-500 whitespace-nowrap">🅿️ {plan.maxSlots}台</span>
            )}
            {!isPast && (
              <button
                onClick={() => setEditMode(v => !v)}
                className={`p-0.5 rounded transition-colors ${editMode ? 'text-amber-400 bg-amber-500/20' : 'text-slate-600 hover:text-slate-400'}`}
              >
                <EditIcon size={14} />
              </button>
            )}
          </div>
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
                  {isAdmin && slot.status === 'pending' && (
                    <button onClick={() => onMarkUsed(plan.id, slot.memberId)} className="text-[9px] text-slate-500 hover:text-green-400 px-1.5 py-0.5 rounded border border-slate-700 hover:border-green-500/50 transition-colors">使用</button>
                  )}
                  {editMode && (
                    <button onClick={() => setSkipTarget(slot.memberId)} className="text-[9px] text-slate-500 hover:text-amber-400 px-1.5 py-0.5 rounded border border-slate-700 hover:border-amber-500/50 transition-colors">スキップ</button>
                  )}
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
                {editMode && !isPast && (
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

// ---- WeatherAreaInput ----
function WeatherAreaInput({ value, onChange, pastAreas }: {
  value: string;
  onChange: (v: string) => void;
  pastAreas: string[];
}) {
  const [suggestions, setSuggestions] = useState<{ name: string; display: string }[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (v: string) => {
    onChange(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (v.length < 1) { setSuggestions([]); setOpen(false); return; }
    timerRef.current = setTimeout(() => {
      fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(v)}&format=json&limit=5&countrycodes=jp&accept-language=ja&addressdetails=1&featuretype=settlement`,
        { headers: { 'User-Agent': 'SCHSoccerApp/1.0' } }
      )
        .then(r => r.json())
        .then((results: any[]) => {
          const items = results.map((r: any) => {
            const addr = r.address ?? {};
            const name = addr.city ?? addr.town ?? addr.county ?? addr.state ?? r.display_name.split(',')[0].trim();
            const display = r.display_name.split(',').slice(0, 3).join(', ');
            return { name, display };
          }).filter(i => i.name);
          const seen = new Set<string>();
          const unique = items.filter(i => { if (seen.has(i.name)) return false; seen.add(i.name); return true; });
          setSuggestions(unique);
          setOpen(unique.length > 0);
        })
        .catch(() => {});
    }, 400);
  };

  const select = (name: string) => { onChange(name); setSuggestions([]); setOpen(false); };

  return (
    <div className="relative">
      {pastAreas.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {pastAreas.map(a => (
            <button key={a} type="button" onClick={() => select(a)}
              className="text-[11px] px-2 py-0.5 rounded-full bg-sky-800/50 text-sky-300 border border-sky-700/50 active:opacity-70">
              📍 {a}
            </button>
          ))}
        </div>
      )}
      <input
        type="text" value={value} onChange={e => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="例：山梨、横浜"
        className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-sky-400 focus:outline-none placeholder-slate-500"
      />
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-xl overflow-hidden">
          {suggestions.map(s => (
            <button key={s.name} type="button" onMouseDown={() => select(s.name)}
              className="w-full text-left px-3 py-2.5 text-sm text-white hover:bg-slate-700 border-b border-slate-700/50 last:border-0">
              <span className="font-semibold">{s.name}</span>
              <span className="text-[11px] text-slate-400 ml-1.5">{s.display}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- SuggestInput ----
function SuggestInput({ value, onChange, suggestions, placeholder, className }: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  className: string;
}) {
  const chips = suggestions.filter(s => !value || s.toLowerCase().includes(value.toLowerCase()));
  return (
    <div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {chips.map(s => (
            <button key={s} type="button" onClick={() => onChange(s)}
              className={`text-[11px] px-2 py-0.5 rounded-full border active:opacity-70 ${value === s ? 'bg-blue-700/60 text-blue-200 border-blue-600/50' : 'bg-slate-700/60 text-slate-300 border-slate-600/50'}`}>
              {s}
            </button>
          ))}
        </div>
      )}
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={className} />
    </div>
  );
}

// ---- EventForm ----
function EventForm({
  initialEvent,
  initialDate,
  members,
  pastWeatherAreas,
  pastLocations,
  pastOpponents,
  onSave,
  onClose,
}: {
  initialEvent?: SchEvent;
  initialDate?: string;
  members: SchMember[];
  pastWeatherAreas: string[];
  pastLocations: string[];
  pastOpponents: string[];
  onSave: (event: SchEvent, notifyLine: boolean) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<SchEventType>(initialEvent?.type ?? 'practice');
  const [date, setDate] = useState(initialEvent?.date ?? initialDate ?? todayStr());
  const [endDate, setEndDate] = useState(initialEvent?.endDate ?? '');
  const [startTime, setStartTime] = useState(initialEvent?.startTime ?? '');
  const [endTime, setEndTime] = useState(initialEvent?.endTime ?? '');
  const [location, setLocation] = useState(initialEvent?.location ?? '');
  const [weatherArea, setWeatherArea] = useState(initialEvent?.weatherArea ?? '');
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

  // Attached images
  const [images, setImages] = useState<string[]>(initialEvent?.images ?? []);
  const imgFileRef = useRef<HTMLInputElement>(null);
  const [notifyLine, setNotifyLine] = useState(true);

  const compressEventImage = useCallback((blob: Blob): Promise<string> => {
    return new Promise(resolve => {
      const img = new window.Image();
      const objUrl = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        const maxW = 1024;
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(''); };
      img.src = objUrl;
    });
  }, []);

  // クリップボードペースト（フォーム展開中）
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) compressEventImage(file).then(d => { if (d) setImages(prev => prev.length < 5 ? [...prev, d] : prev); });
          break;
        }
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [compressEventImage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const base: SchEvent = {
      id: initialEvent?.id ?? generateId(),
      date, type,
      endDate: (type === 'match' || type === 'camp' || type === 'off') && endDate ? endDate : undefined,
      startTime: type !== 'off' && startTime ? startTime : undefined,
      endTime: type !== 'off' && endTime ? endTime : undefined,
      location: type !== 'off' && location ? location : undefined,
      weatherArea: type !== 'off' && weatherArea.trim() ? weatherArea.trim() : undefined,
      label: type !== 'off' && label ? label : undefined,
      note: note || undefined,
      meetingTime: (type === 'match' || type === 'camp' || type === 'other') && meetingTime ? meetingTime : undefined,
      meetingPlace: (type === 'match' || type === 'camp' || type === 'other') && meetingPlace ? meetingPlace : undefined,
      maxParkingSlots: type !== 'off' ? (parkingAvailable ? (parkingUnlimited ? -1 : (maxParkingSlots !== DEFAULT_MAX_SLOTS ? maxParkingSlots : undefined)) : 0) : undefined,
      images: images.length > 0 ? images : undefined,
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
    onSave(base, notifyLine);
    onClose();
  };

  const inputCls = 'w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none placeholder-slate-500';
  const labelCls = 'block text-xs font-semibold text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg border border-white/10 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
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
                {(['practice','match','camp','other','off'] as SchEventType[]).map(t => (
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
              {(type === 'match' || type === 'camp' || type === 'off') && (
                <div className="flex-1">
                  <label className={labelCls}>📅 終了日（期間の場合）</label>
                  <input type="date" value={endDate ? toInputDate(endDate) : ''} onChange={e => setEndDate(e.target.value ? fromInputDate(e.target.value) : '')} className={inputCls} />
                </div>
              )}
            </div>
            {type !== 'off' && (
              <div className="flex gap-2">
                <div className="flex-1"><label className={labelCls}>⏰ 開始</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputCls} /></div>
                <div className="flex-1"><label className={labelCls}>⏰ 終了</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputCls} /></div>
              </div>
            )}

            {/* Location & Label */}
            {type !== 'off' && <div><label className={labelCls}>📍 場所</label><SuggestInput value={location} onChange={setLocation} suggestions={pastLocations} placeholder="例: ○○グラウンド" className={inputCls} /></div>}
            {type !== 'off' && (
              <div>
                <label className={labelCls}>🌤️ 天気の地域（任意）</label>
                <WeatherAreaInput value={weatherArea} onChange={setWeatherArea} pastAreas={pastWeatherAreas} />
                <p className="text-[10px] text-slate-500 mt-1">入力すると「次の予定」に天気予報が表示されます</p>
              </div>
            )}
            {type !== 'off' && <div><label className={labelCls}>{type === 'match' ? '🏆 大会名（任意）' : '📋 イベント名'}</label><input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder={type === 'match' ? '例: 神奈川カップ2026' : '例: 通常練習'} className={inputCls} /></div>}
            <div><label className={labelCls}>{type === 'off' ? '📝 理由・メモ（任意）' : '📝 メモ'}</label><textarea value={note} onChange={e => setNote(e.target.value)} placeholder={type === 'off' ? '例: 雨天中止、祝日、夏季休暇など' : '持ち物・備考など'} rows={3} className={inputCls + ' resize-none'} /></div>

            {/* Meeting info (match / camp / other) */}
            {(type === 'match' || type === 'camp' || type === 'other') && (
              <div className="space-y-3 border-t border-white/10 pt-3">
                <p className="text-xs font-bold text-sky-400/70 uppercase tracking-wider">🚩 集合情報（任意）</p>
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
            {type !== 'off' && <div>
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
            </div>}

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
                      pastOpponents={pastOpponents}
                    />
                  );
                })}

                {/* 試合追加ボタン */}
                <button type="button" onClick={() => setMatches(prev => {
                    const m = emptyMatchState();
                    if (matchType === 'トレマ' && prev.length > 0) m.opponentName = prev[prev.length - 1].opponentName;
                    return [...prev, m];
                  })}
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

            {/* 画像添付 */}
            <div>
              <label className={labelCls}>📷 画像を添付（任意・最大5枚）</label>
              {images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 mb-2">
                  {images.map((src, i) => (
                    <div key={i} className="relative flex-none w-24 aspect-video rounded-lg overflow-hidden bg-slate-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                        className="absolute top-0.5 right-0.5 bg-black/70 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">✕</button>
                    </div>
                  ))}
                </div>
              )}
              {images.length < 5 && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => imgFileRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-sky-500/30 bg-sky-950/30 py-2.5 text-xs text-sky-400/60 hover:border-sky-400/60 transition-colors cursor-pointer">
                    🗂️ ファイルを選択
                  </button>
                  <button type="button" onClick={async () => {
                    if (!navigator.clipboard?.read) { alert('ファイルを選択してください'); return; }
                    try {
                      const items = await navigator.clipboard.read();
                      for (const item of items) {
                        for (const t of item.types) {
                          if (t.startsWith('image/')) {
                            const blob = await item.getType(t);
                            const d = await compressEventImage(blob);
                            if (d) setImages(prev => prev.length < 5 ? [...prev, d] : prev);
                            return;
                          }
                        }
                      }
                      alert('クリップボードに画像がありません');
                    } catch { alert('クリップボードへのアクセスが許可されていません'); }
                  }}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-sky-500/30 bg-sky-950/30 py-2.5 text-xs text-sky-400/60 hover:border-sky-400/60 transition-colors cursor-pointer">
                    📋 貼り付け
                  </button>
                </div>
              )}
              <input ref={imgFileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={async e => {
                  const files = Array.from(e.target.files ?? []).slice(0, 5 - images.length);
                  const results = await Promise.all(files.map(f => compressEventImage(f)));
                  setImages(prev => [...prev, ...results.filter(Boolean)].slice(0, 5));
                  e.target.value = '';
                }} />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={notifyLine} onChange={e => setNotifyLine(e.target.checked)} className="w-4 h-4 accent-green-500" />
              <span className="text-sm text-slate-300">💬 LINE通知</span>
            </label>
            <button type="submit" className="w-full bg-gradient-to-r from-sky-500 to-cyan-600 hover:from-sky-400 hover:to-cyan-500 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-all">保存</button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ---- EventImageGallery ----
function EventImageGallery({ images }: { images: string[] }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  return (
    <>
      <div>
        <p className="text-[10px] font-bold text-sky-400/70 uppercase tracking-wider mb-1.5">📷 添付画像</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button key={i} type="button" onClick={(e) => { e.stopPropagation(); setLightbox(i); }}
              className="flex-none w-28 aspect-video rounded-lg overflow-hidden bg-slate-700 hover:opacity-90 transition-opacity">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
      {lightbox !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); setLightbox(null); }}>
          <div className="relative max-w-full max-h-full p-4" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[lightbox]} alt="" className="max-w-[90vw] max-h-[80vh] rounded-xl object-contain" />
            <div className="flex items-center justify-between mt-3 gap-4">
              <button disabled={lightbox === 0} onClick={(e) => { e.stopPropagation(); setLightbox(p => p! - 1); }}
                className="text-white text-2xl disabled:opacity-30 px-3">‹</button>
              <span className="text-slate-400 text-sm">{lightbox + 1} / {images.length}</span>
              <button disabled={lightbox === images.length - 1} onClick={(e) => { e.stopPropagation(); setLightbox(p => p! + 1); }}
                className="text-white text-2xl disabled:opacity-30 px-3">›</button>
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            className="absolute top-4 right-4 text-white text-3xl leading-none">✕</button>
        </div>
      )}
    </>
  );
}

// ---- EventCard ----
function EventCard({
  event, members, onEdit, onDelete, externalExpanded = false,
}: {
  event: SchEvent;
  members: SchMember[];
  onEdit: () => void;
  onDelete: () => void;
  externalExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { if (externalExpanded) setExpanded(true); }, [externalExpanded]);
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
      <div className={`${isPast ? 'bg-slate-800/40' : cfg.bg} px-3 py-3 cursor-pointer`} onClick={() => setExpanded(p => !p)}>
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
              <>
                {event.label && (
                  <p className="text-sm font-semibold text-white mt-1 truncate">🏆 {event.label}</p>
                )}
                <p className={`${event.label ? 'text-xs text-slate-300 mt-0.5' : 'text-sm font-semibold text-white mt-1'} truncate`}>
                  {matchCount > 1
                    ? (firstMatch?.opponentName ? `🆚 ${firstMatch.opponentName} ほか${matchCount - 1}試合` : `${matchCount}試合`)
                    : (firstMatch?.opponentName ? `🆚 ${firstMatch.opponentName}` : '相手未定')}
                </p>
              </>
            ) : event.type === 'off' ? (
              <p className="text-sm font-semibold text-sky-200 mt-1">{event.note || '休みの日'}</p>
            ) : (
              <p className="text-sm font-semibold text-white mt-1 truncate">{event.label || event.location || '（タイトルなし）'}</p>
            )}
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
            {event.type !== 'match' && event.type !== 'off' && (event.startTime || event.endTime) && (
              <p className="text-xs text-slate-400">⏰ {event.startTime ?? ''}{event.startTime && event.endTime ? ' 〜 ' : ''}{event.endTime ?? ''}</p>
            )}
            {event.type !== 'off' && event.location && <p className="text-xs text-slate-400 truncate">📍 {event.location}</p>}
            {event.type !== 'off' && (event.meetingTime || event.meetingPlace) && (
              <p className="text-xs text-amber-300/90 mt-0.5">
                🚩 集合{event.meetingTime ? ` ${event.meetingTime}` : ''}{event.meetingPlace ? ` ${event.meetingPlace}` : ''}
              </p>
            )}
            {event.type !== 'off' && event.maxParkingSlots !== undefined && (
              event.maxParkingSlots === 0
                ? <p className="text-xs text-red-400/80 mt-0.5">🚫 駐車場なし</p>
                : event.maxParkingSlots === -1
                  ? <p className="text-xs text-emerald-400/80 mt-0.5">🅿️ 駐車場制限なし</p>
                  : <p className="text-xs text-blue-400/80 mt-0.5">🅿️ 駐車場 {event.maxParkingSlots}台</p>
            )}
          </div>
          {/* Actions */}
          <div className="flex flex-col gap-1 flex-shrink-0 items-end" onClick={e => e.stopPropagation()}>
            <button onClick={onEdit} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700">編集</button>
            <button onClick={onDelete} className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-slate-700">削除</button>
            <span className="text-slate-500 text-xs mt-1 pointer-events-none">{expanded ? '▲' : '▼'}</span>
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
                <p className="text-[10px] font-bold text-sky-400/70 uppercase tracking-wider mb-2">
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
              {m.memo && <p className="text-xs text-slate-300 italic whitespace-pre-wrap">💬 {m.memo}</p>}
              {/* 動画URL（複数対応） */}
              {(m.videoUrls ?? (m.videoUrl ? [m.videoUrl] : [])).map((url, vi) => (
                <a key={vi} href={url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1 mr-2 text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2">
                  🎬 動画{(m.videoUrls ?? (m.videoUrl ? [m.videoUrl] : [])).length > 1 ? `${vi + 1}` : 'を見る'}
                </a>
              ))}
            </div>
          ))}

          {/* 添付画像 */}
          {event.images && event.images.length > 0 && (
            <EventImageGallery images={event.images} />
          )}

          {/* Note */}
          {event.note && <p className="text-xs text-slate-400 whitespace-pre-wrap">📝 {event.note}</p>}

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
            {event.type === 'match' ? (() => {
              const ms = getMatches(event);
              const oppText = ms.length > 1 ? `🆚 ${ms[0]?.opponentName ?? '?'} 他${ms.length - 1}試合` : (ms[0]?.opponentName ? `🆚 ${ms[0].opponentName}` : '相手未定');
              return event.label ? (
                <>
                  <p className="text-xs font-bold text-white mt-0.5 truncate">🏆 {event.label}</p>
                  <p className="text-[10px] text-slate-300 truncate leading-tight">{oppText}</p>
                </>
              ) : (
                <p className="text-xs font-bold text-white mt-0.5 truncate">{oppText}</p>
              );
            })() : (
              <p className="text-xs font-bold text-white mt-0.5 truncate">
                {event.label || event.location || (event.type === 'off' ? event.note : undefined) || '詳細未定'}
              </p>
            )}
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
  const prevMonthDays = new Date(viewYear, viewMonth - 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  // prev/next month actual dates for faded display
  const prevM = viewMonth === 1 ? 12 : viewMonth - 1;
  const prevY = viewMonth === 1 ? viewYear - 1 : viewYear;
  const nextM = viewMonth === 12 ? 1 : viewMonth + 1;
  const nextY = viewMonth === 12 ? viewYear + 1 : viewYear;

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
          if (!day) {
            // prev / next month faded cell
            const isNextMonth = i >= firstDow + daysInMonth;
            const fadedDay = isNextMonth ? i - firstDow - daysInMonth + 1 : prevMonthDays - firstDow + 1 + i;
            const fadedY = isNextMonth ? nextY : prevY;
            const fadedM = isNextMonth ? nextM : prevM;
            const fadedStr = `${fadedY}/${String(fadedM).padStart(2,'0')}/${String(fadedDay).padStart(2,'0')}`;
            const fadedDots = dotMap[fadedStr] ?? [];
            const fadedDow = i % 7;
            return (
              <button key={i} onClick={() => onSelectDate(fadedStr)}
                className="relative flex flex-col items-center pt-1 h-12 rounded-lg hover:bg-slate-700/30 transition-colors opacity-35">
                <span className={`text-xs font-semibold leading-none ${fadedDow === 0 ? 'text-red-400' : fadedDow === 6 ? 'text-blue-400' : 'text-slate-400'}`}>{fadedDay}</span>
                {fadedDots.length > 0 && (
                  <div className="flex gap-0.5 mt-1 items-center justify-center">
                    {fadedDots.slice(0, 2).map((e, j) => (
                      <span key={j} className="text-[9px] leading-none">{tc(e.type).icon}</span>
                    ))}
                    {fadedDots.length > 2 && <span className="text-[7px] text-slate-400 leading-none">+</span>}
                  </div>
                )}
              </button>
            );
          }
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
              {/* Single-day icons — directly below the number */}
              {dots.length > 0 && (
                <div className="flex gap-0.5 items-center justify-center mt-0.5 z-10 flex-wrap max-w-full px-0.5">
                  {dots.slice(0, 3).map((e, j) => (
                    <span key={j} className="text-[9px] leading-none flex-shrink-0">{tc(e.type).icon}</span>
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
                  <div key={e.id} className="contents">
                    <div
                      className={`absolute h-[5px] ${color}`}
                      style={{
                        bottom: `${3 + j * 7}px`,
                        left: isStart && !isRowStart ? '50%' : 0,
                        right: isEnd && !isRowEnd ? '50%' : 0,
                        borderRadius: `${roundL ? '9999px' : '0'} ${roundR ? '9999px' : '0'} ${roundR ? '9999px' : '0'} ${roundL ? '9999px' : '0'}`,
                      }}
                    />
                    {(isStart || isRowStart) && (
                      <span
                        className="absolute text-[8px] leading-none z-20 pointer-events-none"
                        style={{ bottom: `${4 + j * 7}px`, left: isStart && !isRowStart ? 'calc(50% + 2px)' : '2px' }}
                      >
                        {tc(e.type).icon}
                      </span>
                    )}
                  </div>
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

function EventSection({ events, members, onSave, openDetailId }: {
  events: SchEvent[];
  members: SchMember[];
  onSave: (events: SchEvent[], notifyLine: boolean) => void;
  openDetailId?: string | null;
}) {
  const [filter, setFilter] = useState<EventFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SchEvent | null>(null);
  const [calendarDate, setCalendarDate] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(openDetailId ?? null);
  const [popupDay, setPopupDay] = useState<{ date: string; events: SchEvent[] } | null>(null);
  const today = todayStr();

  useEffect(() => { if (openDetailId) setDetailId(openDetailId); }, [openDetailId]);

  const handleSave = (ev: SchEvent, notifyLine: boolean) => {
    const updated = editing
      ? events.map(e => e.id === ev.id ? ev : e)
      : [...events, ev];
    onSave(updated.sort((a, b) => a.date.localeCompare(b.date)), notifyLine);
  };
  const handleDelete = (id: string) => {
    if (window.confirm('削除しますか？')) onSave(events.filter(e => e.id !== id), false);
  };
  const openEdit = (ev: SchEvent) => { setEditing(ev); setShowForm(true); };
  const openDetail = (ev: SchEvent) => { setDetailId(ev.id); setTimeout(() => { document.getElementById(`event-card-${ev.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50); };
  const closePopup = () => setPopupDay(null);
  const scrollToEvent = (ev: SchEvent) => {
    closePopup();
    if (isEventPast(ev)) {
      const el = document.getElementById('past-events-details') as HTMLDetailsElement | null;
      if (el) el.open = true;
    }
    setTimeout(() => {
      const card = document.getElementById(`event-card-${ev.id}`);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  const pastWeatherAreas = useMemo(() => {
    const seen = new Set<string>();
    return events.flatMap(e => e.weatherArea ? [e.weatherArea] : []).filter(a => { if (seen.has(a)) return false; seen.add(a); return true; });
  }, [events]);

  const pastLocations = useMemo(() => {
    const seen = new Set<string>();
    return [...events].sort((a, b) => b.date.localeCompare(a.date))
      .flatMap(e => e.location ? [e.location] : [])
      .filter(a => { if (seen.has(a)) return false; seen.add(a); return true; })
      .slice(0, 6);
  }, [events]);

  const pastOpponents = useMemo(() => {
    const seen = new Set<string>();
    return [...events].sort((a, b) => b.date.localeCompare(a.date))
      .flatMap(e => {
        if (e.type !== 'match') return [];
        const ms = (e.matches && e.matches.length > 0) ? e.matches : (e.opponentName ? [{ opponentName: e.opponentName }] : []);
        return ms.flatMap(m => m.opponentName ? [m.opponentName] : []);
      })
      .filter(a => { if (seen.has(a)) return false; seen.add(a); return true; })
      .slice(0, 6);
  }, [events]);

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
    { key: 'off',      icon: '🏖️', label: 'OFF' },
  ];

  return (
    <div className="space-y-3">
      <button
        onClick={() => { setEditing(null); setShowForm(true); }}
        className="w-full bg-gradient-to-r from-sky-500 to-cyan-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <span className="text-lg">＋</span> 予定を追加
      </button>

      {/* Filter tags */}
      <div className="flex gap-1">
        {filterBtns.map(({ key, icon, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-1 py-1.5 rounded-lg border font-semibold transition-colors text-center ${filter === key ? 'bg-sky-600/60 border-sky-500/60 text-white' : 'border-slate-600 text-slate-400 hover:border-sky-500/40 hover:text-white'}`}
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
          <div id={`event-card-${upcoming[0].id}`}>
            <EventCard
              event={upcoming[0]}
              members={members}
              onEdit={() => openEdit(upcoming[0])}
              onDelete={() => handleDelete(upcoming[0].id)}
              externalExpanded={detailId === upcoming[0].id}
            />
          </div>
          {/* 2・3件目：ミニカード横並び */}
          {upcoming.length >= 2 && (
            <div className="flex gap-2 mt-2">
              {upcoming.slice(1, 3).map(ev => (
                <div key={ev.id} className="flex-1 min-w-0">
                  <MiniEventCard event={ev} members={members} onClick={() => openDetail(ev)} />
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
            setPopupDay({ date, events: eventsOnDate.sort((a, b) => a.date.localeCompare(b.date)) });
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
          <summary className="text-[11px] font-bold text-sky-400/70 uppercase tracking-wider cursor-pointer select-none mb-2 list-none flex items-center gap-1">
            <span>📅 全予定 ({upcoming.length}件)</span>
          </summary>
          <div className="space-y-2 mt-2">
            {upcoming.map(ev => (
              <div key={ev.id}>
                <EventCard event={ev} members={members} onEdit={() => openEdit(ev)} onDelete={() => handleDelete(ev.id)} externalExpanded={detailId === ev.id} />
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
          pastWeatherAreas={pastWeatherAreas}
          pastLocations={pastLocations}
          pastOpponents={pastOpponents}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); setCalendarDate(null); }}
        />
      )}

      {/* ── カレンダー日別ポップアップ ── */}
      {popupDay && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end"
          onClick={e => { if (e.target === e.currentTarget) closePopup(); }}
        >
          <div
            className="w-full max-w-lg mx-auto bg-slate-800 rounded-t-2xl shadow-2xl"
            onPointerDown={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-slate-700">
              <h3 className="text-sm font-bold text-white">
                {popupDay.date.replace(/(\d{4})\/(\d{2})\/(\d{2})/, '$1年$2月$3日')}（{dayLabel(popupDay.date)}）の予定
              </h3>
              <button onClick={closePopup} className="text-slate-400 hover:text-white w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-700 text-lg leading-none">×</button>
            </div>
            {/* Event list */}
            <div className="px-4 py-3 space-y-2 max-h-72 overflow-y-auto">
              {popupDay.events.map(ev => {
                const cfg = tc(ev.type);
                const evMs = ev.type === 'match' ? getMatches(ev) : [];
                const evOpp = evMs[0]?.opponentName || ev.opponentName;
                const title = ev.type === 'match'
                  ? [ev.label ? `🏆 ${ev.label}` : null, evOpp ? `🆚 ${evOpp}` : null].filter(Boolean).join(' ') || cfg.label
                  : (ev.label || cfg.label);
                const time = ev.startTime ? `${ev.startTime}${ev.endTime ? '〜' + ev.endTime : ''}` : null;
                return (
                  <button
                    key={ev.id}
                    onClick={() => scrollToEvent(ev)}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-slate-700/60 hover:bg-slate-600/60 active:bg-slate-600 transition-colors"
                  >
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-semibold truncate">{title}</p>
                      {(time || ev.location) && (
                        <p className="text-xs text-slate-400 truncate">{[time, ev.location].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                    <span className="text-slate-500 text-sm shrink-0">›</span>
                  </button>
                );
              })}
            </div>
            {/* Add event shortcut */}
            <div className="px-4 py-3 border-t border-slate-700">
              <button
                onClick={() => { closePopup(); setCalendarDate(popupDay.date); setEditing(null); setShowForm(true); }}
                className="w-full text-center text-xs text-blue-400 hover:text-blue-300 py-1"
              >
                ＋ この日に予定を追加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- VideoLink ----
function VideoLink({ url, index = 0, total = 1 }: { url: string; index?: number; total?: number }) {
  const [state, setState] = useState<'loading' | 'ok' | 'broken'>('loading');
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/check-url?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then((d: { ok: boolean }) => { if (!cancelled) setState(d.ok ? 'ok' : 'broken'); })
      .catch(() => { if (!cancelled) setState('broken'); });
    return () => { cancelled = true; };
  }, [url]);
  const label = total > 1 ? `🎬 動画${index + 1}` : '🎬 動画';
  if (state === 'loading') return <span className="text-[10px] text-slate-500 animate-pulse">🎬…</span>;
  if (state === 'broken') return <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">リンク切れ</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="text-[10px] text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-1.5 py-0.5 rounded transition-colors shrink-0">
      {label}
    </a>
  );
}

// ---- VideoSection ----
const SCH_PLAYLIST_URL = 'https://youtube.com/playlist?list=PLo9LruwA1kPSBNtamp53j4AVZup6aVrin&si=Ws4AaH83BTEiaQRN';

interface YtVideo { videoId: string; title: string; publishedAt: string; thumbnail: string; url: string; }

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}日前`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}週間前`;
  const mo = Math.floor(d / 30);
  return `${mo}ヶ月前`;
}

function relativeDateLabel(text: string): { label: string; isNew: boolean; color: string } | null {
  if (!text) return null;
  let days: number | null = null;
  // Try ISO date first
  const d = new Date(text);
  if (!isNaN(d.getTime())) {
    const today = new Date(); today.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
    days = Math.round((today.getTime() - d.getTime()) / 86400000);
  } else {
    const m1 = text.match(/^(\d+)日前$/);
    const m2 = text.match(/^(\d+)週間前$/);
    const m3 = text.match(/^(\d+)ヶ月前$/);
    const m4 = text.match(/^(\d+)年前$/);
    const m5 = text.match(/(\d+)\s+days?\s+ago/i);
    const m6 = text.match(/(\d+)\s+weeks?\s+ago/i);
    const m7 = text.match(/(\d+)\s+months?\s+ago/i);
    const m8 = text.match(/(\d+)\s+years?\s+ago/i);
    if (/^(今日|just\s+now)$/i.test(text)) days = 0;
    else if (/^(昨日|yesterday)$/i.test(text)) days = 1;
    else if (m1) days = parseInt(m1[1]);
    else if (m2) days = parseInt(m2[1]) * 7;
    else if (m3) days = parseInt(m3[1]) * 30;
    else if (m4) days = parseInt(m4[1]) * 365;
    else if (m5) days = parseInt(m5[1]);
    else if (m6) days = parseInt(m6[1]) * 7;
    else if (m7) days = parseInt(m7[1]) * 30;
    else if (m8) days = parseInt(m8[1]) * 365;
  }
  if (days === null) return null;
  if (days === 0)    return { label: '今日',                          isNew: true,  color: 'bg-emerald-500/90 text-white' };
  if (days <= 30)    return { label: `${days}日前`,                   isNew: false, color: days <= 3 ? 'bg-sky-600/80 text-white' : days <= 7 ? 'bg-sky-700/80 text-white' : 'bg-slate-600/80 text-slate-200' };
  const months = Math.floor(days / 30);
  return               { label: `${months}ヶ月前`,                   isNew: false, color: 'bg-slate-700/80 text-slate-400' };
}

function HomeYtStrip({ onGoToVideo }: { onGoToVideo: () => void }) {
  const [videos, setVideos] = useState<YtVideo[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    fetch('/api/sch/yt-playlist?limit=6')
      .then(r => r.json())
      .then((d: YtVideo[]) => { setVideos(Array.isArray(d) ? d : []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);
  if (loaded && videos.length === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h2 className="text-[11px] font-bold text-sky-400/70 uppercase tracking-wider">📹 最新動画</h2>
        <button onClick={onGoToVideo} className="text-[10px] text-sky-400 hover:text-sky-300">すべて見る →</button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
        {!loaded
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-none rounded-lg bg-slate-700/60 animate-pulse snap-start" style={{ height: '44px', aspectRatio: '16/9' }} />
            ))
          : videos.map(v => {
              const rel = relativeDateLabel(v.publishedAt);
              return (
                <a
                  key={v.videoId}
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-none relative rounded-lg overflow-hidden bg-slate-800 snap-start group"
                  style={{ height: '44px', aspectRatio: '16/9' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-1 pt-0.5 pb-2">
                    <p className="text-[7px] font-semibold text-white leading-snug line-clamp-1">{v.title}</p>
                  </div>
                  {rel && (
                    <div className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5">
                      {rel.isNew && <span className="text-[9px] font-extrabold bg-emerald-400 text-black px-1 rounded leading-none">NEW</span>}
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded leading-none ${rel.color}`}>{rel.label}</span>
                    </div>
                  )}
                </a>
              );
            })
        }
      </div>
    </div>
  );
}

function YtChannelSection() {
  const [videos, setVideos] = useState<YtVideo[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/sch/yt-playlist')
      .then(r => r.json())
      .then((d: YtVideo[]) => { setVideos(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-2">
      {/* チャンネルボタン */}
      <a
        href={SCH_PLAYLIST_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between w-full bg-red-700/30 hover:bg-red-700/50 border border-red-500/40 rounded-xl px-4 py-3 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Image src="/youtube-icon.svg" alt="YouTube" width={28} height={20} className="flex-none" />
          <div>
            <p className="text-sm font-bold text-white">SCH チーム動画チャンネル</p>
            <p className="text-[10px] text-slate-400">YouTube プレイリスト</p>
          </div>
        </div>
        <span className="text-slate-400 text-sm">→</span>
      </a>

      {/* 直近6本 + もっと見るボタン */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-none w-36 aspect-video rounded-lg bg-slate-700/60 animate-pulse snap-start" />
          ))
        ) : videos.length === 0 ? null : (
          <>
            {videos.map(v => (
              <a
                key={v.videoId}
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-none w-36 relative rounded-lg overflow-hidden bg-slate-800 snap-start group"
              >
                <div className="aspect-video relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  {/* タイトル（上部グラデーション） */}
                  <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/75 to-transparent p-1.5 pb-4">
                    <p className="text-[9px] font-semibold text-white leading-snug line-clamp-2">{v.title}</p>
                  </div>
                  {/* 投稿日（右下）相対ラベル */}
                  {(() => {
                    const rel = relativeDateLabel(v.publishedAt);
                    if (!rel) return null;
                    return (
                      <div className="absolute bottom-1 right-1 flex items-center gap-0.5">
                        {rel.isNew && (
                          <span className="text-[11px] font-extrabold bg-emerald-400 text-black px-1 py-0.5 rounded leading-none">NEW</span>
                        )}
                        <span className={`text-[12px] font-semibold px-1.5 py-0.5 rounded leading-none ${rel.color}`}>{rel.label}</span>
                      </div>
                    );
                  })()}
                  {/* 再生ボタン */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                    <span className="text-white text-xl">▶</span>
                  </div>
                </div>
              </a>
            ))}
            {/* もっと見る */}
            <a
              href={SCH_PLAYLIST_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-none w-24 snap-start flex flex-col items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-900/20 hover:bg-red-900/40 transition-colors"
            >
              <span className="text-xl">▶️</span>
              <p className="text-[10px] font-semibold text-red-300 text-center leading-tight">もっと見る</p>
            </a>
          </>
        )}
      </div>
    </div>
  );
}

function getYoutubeThumbnail(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

// サムネイルをAPIから取得（YouTube以外）。ユーザー提供があればそちらを優先
function useThumbnail(url: string, overrideDataUrl?: string): string | null | 'loading' {
  const ytThumb = getYoutubeThumbnail(url);
  const [thumb, setThumb] = useState<string | null | 'loading'>(
    overrideDataUrl ? overrideDataUrl : (ytThumb ?? 'loading')
  );
  useEffect(() => {
    if (overrideDataUrl) { setThumb(overrideDataUrl); return; }
    if (ytThumb) { setThumb(ytThumb); return; }
    let cancelled = false;
    fetch(`/api/og-thumbnail?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then((d: { url: string | null }) => { if (!cancelled) setThumb(d.url); })
      .catch(() => { if (!cancelled) setThumb(null); });
    return () => { cancelled = true; };
  }, [url, ytThumb, overrideDataUrl]);
  return thumb;
}

// 1エントリ分のサムネイルセル（VideoTile内で使用）
function VideoThumbCell({ entry, index, total, onDelete, onEditThumb }: {
  entry: VideoEntry; index: number; total: number; onDelete?: () => void; onEditThumb?: () => void;
}) {
  const thumb = useThumbnail(entry.url, entry.thumbnailDataUrl);
  return (
    <a
      href={entry.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex-1 min-w-0 overflow-hidden bg-slate-700"
      style={total > 1 && index > 0 ? { borderLeft: '1px solid rgba(255,255,255,0.08)' } : undefined}
    >
      {thumb === 'loading' ? (
        <div className="w-full h-full flex items-center justify-center text-slate-600 animate-pulse text-xl">🎬</div>
      ) : thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xl text-slate-500">🎬</div>
      )}
      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-white text-lg">▶</span>
      </div>
      {total > 1 && (
        <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-slate-300 px-1 rounded">{index + 1}</span>
      )}
      {onEditThumb && (
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onEditThumb(); }}
          className="absolute bottom-0.5 right-0.5 text-[9px] bg-slate-900/80 text-slate-400 hover:text-blue-300 px-1 py-0.5 rounded-full transition-colors sm:opacity-0 sm:group-hover:opacity-100"
        >📷</button>
      )}
      {onDelete && (
        <button
          onClick={e => { e.preventDefault(); if (window.confirm('この動画を削除しますか？')) onDelete(); }}
          className="absolute top-0.5 right-0.5 text-[9px] bg-slate-900/80 text-slate-400 hover:text-red-400 px-1 py-0.5 rounded-full transition-colors"
        >×</button>
      )}
    </a>
  );
}

function VideoTile({ v, onDelete, onEditThumb, groupIndex }: { v: VideoItem; onDelete?: (standaloneId: string) => void; onEditThumb?: (url: string) => void; groupIndex?: number }) {
  const won = v.score ? v.score.home > v.score.away : null;
  const drew = v.score ? v.score.home === v.score.away : null;
  return (
    <div className="bg-slate-800/80 border border-white/10 rounded-xl overflow-hidden hover:border-sky-500/30 transition-colors">
      {/* サムネイルエリア（複数なら横分割） */}
      <div className="aspect-video flex">
        {v.entries.map((entry, i) => (
          <VideoThumbCell
            key={entry.url}
            entry={entry}
            index={i}
            total={v.entries.length}
            onDelete={entry.standaloneId && onDelete ? () => onDelete(entry.standaloneId!) : undefined}
            onEditThumb={onEditThumb ? () => onEditThumb(entry.url) : undefined}
          />
        ))}
      </div>
      {/* スコアバッジ */}
      {v.score && (
        <div className={`absolute top-1 right-1 pointer-events-none text-[10px] font-extrabold px-1.5 py-0.5 rounded-full z-10 ${won ? 'bg-green-600/90 text-white' : drew ? 'bg-slate-600/90 text-white' : 'bg-red-600/90 text-white'}`}>
          {v.score.home}−{v.score.away}
        </div>
      )}
      {/* メタ情報 */}
      <div className="px-2 py-1.5 relative">
        {v.score && (
          <span className={`absolute top-1.5 right-2 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${won ? 'bg-green-600/80 text-white' : drew ? 'bg-slate-600/80 text-white' : 'bg-red-600/80 text-white'}`}>
            {v.score.home}−{v.score.away}
          </span>
        )}
        {v.opponent && (
          <p className="text-[11px] font-semibold text-white truncate pr-10">
            {v.matchType === 'トレマ' && groupIndex != null && <span className="text-slate-400 font-normal mr-1">第{groupIndex + 1}試合</span>}
            🆚 {v.opponent}
          </p>
        )}
        {!v.opponent && v.title && (
          <p className="text-[11px] font-semibold text-white truncate">
            {v.matchType === 'トレマ' && groupIndex != null && <span className="text-slate-400 font-normal mr-1">第{groupIndex + 1}試合</span>}
            {v.title}
          </p>
        )}
        {!v.opponent && !v.title && v.matchType === 'トレマ' && groupIndex != null && (
          <p className="text-[11px] text-slate-400 truncate">第{groupIndex + 1}試合</p>
        )}
        <p className="text-[10px] text-slate-500 mt-0.5">{v.date}{v.entries.length > 1 ? ` · ${v.entries.length}本` : ''}</p>
      </div>
    </div>
  );
}

// 1つの動画エントリ（URLひとつ分）
type VideoEntry = {
  url: string;
  thumbnailDataUrl?: string;
  standaloneId?: string; // 削除対象特定用
};

// タイル1枚 = 同じ試合・イベント・スタンドアロンをまとめたグループ
type VideoItem = {
  id: string;
  entries: VideoEntry[];
  date: string;
  postedAt: string;
  tournamentName?: string;
  matchType?: string;
  opponent?: string;
  score?: { home: number; away: number };
  source: 'event' | 'standalone';
  title?: string;
  eventId?: string;
};

function VideoSection({
  events, standaloneVideos, onSaveStandaloneVideos, videoThumbnails, onSaveVideoThumbnails,
}: {
  events: SchEvent[];
  standaloneVideos: SchStandaloneVideo[];
  onSaveStandaloneVideos: (v: SchStandaloneVideo[]) => void;
  videoThumbnails: Record<string, string>;
  onSaveVideoThumbnails: (t: Record<string, string>) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [formUrl, setFormUrl] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formEventId, setFormEventId] = useState('');
  const [formMatchId, setFormMatchId] = useState('');
  const [formThumb, setFormThumb] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editThumbUrl, setEditThumbUrl] = useState<string | null>(null);
  const [editThumbData, setEditThumbData] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // 画像をbase64に圧縮（max 640x360, JPEG 0.75）
  const compressImage = useCallback((blob: Blob): Promise<string> => {
    return new Promise(resolve => {
      const img = new window.Image();
      const objUrl = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        const maxW = 640, maxH = 360;
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(''); };
      img.src = objUrl;
    });
  }, []);

  // クリップボードから画像を取得（モバイル用ボタン経由 + デスクトップ兼用）
  const pasteFromClipboard = useCallback(async (onData: (d: string) => void) => {
    if (!navigator.clipboard?.read) {
      alert('このブラウザはクリップボードの読み取りに対応していません\n画像ファイルを選択してください');
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const data = await compressImage(blob);
            if (data) { onData(data); return; }
          }
        }
      }
      alert('クリップボードに画像がありません');
    } catch {
      alert('クリップボードへのアクセスが許可されていません\nブラウザの許可設定を確認してください');
    }
  }, [compressImage]);

  // フォームが開いているときグローバルペーストをキャプチャ（デスクトップ Ctrl+V 用）
  useEffect(() => {
    if (!showForm && !editThumbUrl) return;
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) compressImage(file).then(d => {
            if (d) {
              if (editThumbUrl) setEditThumbData(d);
              else setFormThumb(d);
            }
          });
          break;
        }
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [showForm, editThumbUrl, compressImage]);

  // 試合イベント一覧（フォームのセレクタ用）
  const matchEvents = useMemo(
    () => [...events].filter(e => e.type === 'match').sort((a, b) => b.date.localeCompare(a.date)),
    [events]
  );

  // イベント動画を試合単位でグループ化（1試合→1タイル）
  const eventVideos = useMemo<VideoItem[]>(() => {
    const items: VideoItem[] = [];
    for (const ev of events) {
      if (ev.type !== 'match') continue;
      const matches = getMatches(ev);
      for (const m of matches) {
        const urls = m.videoUrls ?? (m.videoUrl ? [m.videoUrl] : []);
        if (urls.length === 0) continue;
        items.push({
          id: `ev_${ev.id}_${m.id}`,
          entries: urls.map(url => ({ url, thumbnailDataUrl: videoThumbnails[url] })),
          date: ev.date,
          postedAt: ev.date,
          tournamentName: ev.label,
          matchType: ev.matchType,
          opponent: m.opponentName,
          score: m.homeScore != null && m.awayScore != null
            ? { home: m.homeScore, away: m.awayScore } : undefined,
          source: 'event',
          eventId: ev.id,
        });
      }
    }
    return items;
  }, [events, videoThumbnails]);

  // スタンドアロン動画（イベント紐づけ情報を付与、1件→1タイル）
  const standaloneItems = useMemo<VideoItem[]>(() => {
    return standaloneVideos.map(sv => {
      const ev = sv.eventId ? events.find(e => e.id === sv.eventId) : undefined;
      const m = ev && sv.matchId ? getMatches(ev).find(x => x.id === sv.matchId) : undefined;
      return {
        id: sv.id,
        entries: [{ url: sv.url, thumbnailDataUrl: videoThumbnails[sv.url] ?? sv.thumbnailDataUrl, standaloneId: sv.id }],
        date: ev?.date ?? sv.postedAt.slice(0, 10).replace(/-/g, '/'),
        postedAt: sv.postedAt,
        tournamentName: ev?.label ?? undefined,
        opponent: m?.opponentName ?? undefined,
        score: (m?.homeScore != null && m?.awayScore != null)
          ? { home: m.homeScore, away: m.awayScore } : undefined,
        source: 'standalone' as const,
        title: sv.title,
        eventId: sv.eventId,
      };
    });
  }, [standaloneVideos, events, videoThumbnails]);

  // 全動画を新しい順にソートしてグループ化
  const allVideos = useMemo(() => {
    const all = [...eventVideos, ...standaloneItems].sort((a, b) => {
      return b.date.localeCompare(a.date) || b.postedAt.localeCompare(a.postedAt);
    });
    // グループ化 key: トレマは日付ごと、大会名あり→大会名、それ以外→日付
    const groups: { key: string; label: string; items: VideoItem[] }[] = [];
    const seen = new Map<string, VideoItem[]>();
    for (const v of all) {
      const useDate = v.matchType === 'トレマ' || !v.tournamentName;
      const key = useDate ? `__date__${v.date}` : v.tournamentName!;
      const label = useDate ? `${v.date}（${dayLabel(v.date)}）` : v.tournamentName!;
      if (!seen.has(key)) { seen.set(key, []); groups.push({ key, label, items: seen.get(key)! }); }
      seen.get(key)!.push(v);
    }
    return groups;
  }, [eventVideos, standaloneItems]);

  const inputCls = 'w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none placeholder-slate-500';

  const handlePost = () => {
    if (!formUrl.trim()) return;
    const sv: SchStandaloneVideo = {
      id: generateId(),
      url: formUrl.trim(),
      title: formTitle.trim() || undefined,
      postedAt: new Date().toISOString(),
      eventId: formEventId || undefined,
      matchId: formMatchId || undefined,
      thumbnailDataUrl: formThumb || undefined,
    };
    onSaveStandaloneVideos([sv, ...standaloneVideos]);
    if (formThumb) onSaveVideoThumbnails({ ...videoThumbnails, [sv.url]: formThumb });
    setFormUrl(''); setFormTitle(''); setFormEventId(''); setFormMatchId(''); setFormThumb(null);
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    onSaveStandaloneVideos(standaloneVideos.filter(v => v.id !== id));
  };

  const openEditThumb = (url: string) => {
    setEditThumbUrl(url);
    setEditThumbData(videoThumbnails[url] ?? null);
  };
  const saveEditThumb = () => {
    if (!editThumbUrl) return;
    const next = { ...videoThumbnails };
    if (editThumbData) next[editThumbUrl] = editThumbData;
    else delete next[editThumbUrl];
    onSaveVideoThumbnails(next);
    setEditThumbUrl(null);
    setEditThumbData(null);
  };

  return (
    <div className="space-y-5">
      {/* SCH チャンネルと直近動画 */}
      <YtChannelSection />

      {/* 投稿ボタン */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-sky-400/70 uppercase tracking-wider">🎬 動画ライブラリ</p>
        <button
          onClick={() => setShowForm(p => !p)}
          className="flex items-center gap-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
        >
          ＋ 動画を投稿
        </button>
      </div>

      {/* 投稿フォーム */}
      {showForm && (
        <div className="bg-slate-800/80 border border-white/10 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-bold text-white">動画URLを投稿</p>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">🎬 動画URL（YouTube / BAND）</label>
            <input type="url" value={formUrl} onChange={e => setFormUrl(e.target.value)} placeholder="https://..." className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">📝 タイトル（任意）</label>
            <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="例: 準決勝ハイライト" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">🔗 イベントに紐づける（任意）</label>
            <select value={formEventId} onChange={e => { setFormEventId(e.target.value); setFormMatchId(''); }} className={inputCls}>
              <option value="">紐づけなし</option>
              {matchEvents.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.date}{ev.label ? ` 🏆 ${ev.label}` : ' 試合'}
                </option>
              ))}
            </select>
          </div>
          {formEventId && (() => {
            const ev = matchEvents.find(e => e.id === formEventId);
            const ms = ev ? getMatches(ev) : [];
            return (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">⚽ 試合を指定（任意）</label>
                <select value={formMatchId} onChange={e => setFormMatchId(e.target.value)} className={inputCls}>
                  <option value="">イベント全体（試合を指定しない）</option>
                  {ms.map((m, i) => (
                    <option key={m.id} value={m.id}>
                      {m.roundName || `試合${i + 1}`}
                      {m.opponentName ? ` 🆚 ${m.opponentName}` : ''}
                      {m.homeScore != null && m.awayScore != null ? ` (${m.homeScore}−${m.awayScore})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  {formMatchId ? '選択した試合の対戦相手・スコアが表示されます' : 'イベント全体に紐づけると大会名のみ表示されます'}
                </p>
              </div>
            );
          })()}
          {/* サムネイル */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">🖼 サムネイル（任意・自動取得できない場合）</label>
            {formThumb ? (
              <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={formThumb} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setFormThumb(null)}
                  className="absolute top-1 right-1 bg-slate-900/80 text-white text-xs px-2 py-0.5 rounded-full hover:bg-red-600/80 transition-colors"
                >
                  削除
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-sky-500/30 bg-sky-950/30 py-4 cursor-pointer hover:border-sky-400/60 transition-colors text-center">
                  <span className="text-xl">🗂️</span>
                  <p className="text-xs text-slate-400">ファイルを選択</p>
                </button>
                <button type="button" onClick={() => pasteFromClipboard(d => setFormThumb(d))}
                  className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-sky-500/30 bg-sky-950/30 py-4 cursor-pointer hover:border-sky-400/60 transition-colors text-center">
                  <span className="text-xl">📋</span>
                  <p className="text-xs text-slate-400">貼り付け</p>
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (file) { const d = await compressImage(file); if (d) setFormThumb(d); }
                e.target.value = '';
              }}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handlePost} disabled={!formUrl.trim()} className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-sm font-bold py-2.5 rounded-xl transition-colors">
              投稿する
            </button>
            <button onClick={() => { setShowForm(false); setFormThumb(null); }} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold py-2.5 rounded-xl transition-colors">
              キャンセル
            </button>
          </div>
        </div>
      )}

      {allVideos.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <p className="text-3xl mb-3">🎬</p>
          <p className="text-sm">動画がありません</p>
          <p className="text-xs mt-1">試合のURLまたは上の「動画を投稿」から追加できます</p>
        </div>
      )}

      {/* 大会別グループ */}
      {allVideos.map(group => (
        <div key={group.key}>
          <p className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
            🏆 {group.label}
            <span className="text-slate-600 font-normal">({group.items.length}本)</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {group.items.map((v, gi) => (
              <VideoTile
                key={v.id}
                v={v}
                groupIndex={gi}
                onDelete={v.source === 'standalone' ? handleDelete : undefined}
                onEditThumb={openEditThumb}
              />
            ))}
          </div>
        </div>
      ))}

      {/* ---- サムネイル編集モーダル ---- */}
      {editThumbUrl && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setEditThumbUrl(null); setEditThumbData(null); } }}>
          <div className="bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md border border-white/10 shadow-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">📷 サムネイルを変更</p>
              <button onClick={() => { setEditThumbUrl(null); setEditThumbData(null); }} className="text-slate-400 hover:text-white text-lg">✕</button>
            </div>
            {editThumbData ? (
              <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={editThumbData} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setEditThumbData(null)}
                  className="absolute top-1 right-1 bg-slate-900/80 text-white text-xs px-2 py-0.5 rounded-full hover:bg-red-600/80 transition-colors">削除</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={() => editFileInputRef.current?.click()}
                  className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-sky-500/30 bg-sky-950/30 py-4 cursor-pointer hover:border-sky-400/60 transition-colors text-center">
                  <span className="text-xl">🗂️</span>
                  <p className="text-xs text-slate-400">ファイルを選択</p>
                </button>
                <button type="button" onClick={() => pasteFromClipboard(d => setEditThumbData(d))}
                  className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-sky-500/30 bg-sky-950/30 py-4 cursor-pointer hover:border-sky-400/60 transition-colors text-center">
                  <span className="text-xl">📋</span>
                  <p className="text-xs text-slate-400">貼り付け</p>
                </button>
              </div>
            )}
            <input ref={editFileInputRef} type="file" accept="image/*" className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (file) { const d = await compressImage(file); if (d) setEditThumbData(d); }
                e.target.value = '';
              }} />
            <div className="flex gap-2 pt-1">
              <button onClick={saveEditThumb} className="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold py-2.5 rounded-xl transition-colors">保存</button>
              <button onClick={() => { setEditThumbUrl(null); setEditThumbData(null); }} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold py-2.5 rounded-xl transition-colors">キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
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
      <div className="flex bg-white/5 backdrop-blur rounded-xl p-1 border border-white/10">
        {statTabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatTab(key)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${statTab === key ? 'bg-gradient-to-b from-sky-500/50 to-cyan-600/50 text-sky-50 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
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
              <div className="flex items-center justify-between mb-2">
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
              <div className="flex rounded-full overflow-hidden h-2 bg-slate-700">
                <div className="bg-green-500 transition-all" style={{ width: `${o.w / o.total * 100}%` }} />
                <div className="bg-slate-500 transition-all" style={{ width: `${o.d / o.total * 100}%` }} />
                <div className="bg-red-500 transition-all" style={{ width: `${o.l / o.total * 100}%` }} />
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
        <p className="text-[11px] font-bold text-sky-400/70 uppercase tracking-wider mb-3">📋 試合結果一覧</p>
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
                          {(m.videoUrls ?? (m.videoUrl ? [m.videoUrl] : [])).map((url, vi) => (
                            <VideoLink key={vi} url={url} index={vi} total={(m.videoUrls ?? (m.videoUrl ? [m.videoUrl] : [])).length} />
                          ))}
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
  pastEvents, sortedMembers, parkingRecords, isAdmin, onSaveHistory,
}: {
  pastEvents: SchEvent[];
  sortedMembers: SchMember[];
  parkingRecords: SchParkingRecord[];
  isAdmin?: boolean;
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
      <summary className="text-[11px] font-bold text-sky-400/70 uppercase tracking-wider cursor-pointer list-none flex items-center gap-1.5 select-none">
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
                {isAdmin && isEditing ? (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => saveEdit(ev.id)} className="text-[10px] bg-sky-600 text-white px-2 py-0.5 rounded font-bold">保存</button>
                    <button onClick={() => setEditingId(null)} className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded border border-slate-600">取消</button>
                  </div>
                ) : isAdmin ? (
                  <button onClick={() => openEdit(ev)} className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded border border-slate-600 hover:border-slate-400 flex-shrink-0">編集</button>
                ) : null}
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

// ---- ParkingCommentForm ----
function ParkingCommentForm({
  members, onSubmit, onClose,
}: {
  members: SchMember[];
  onSubmit: (c: SchParkingComment) => void;
  onClose: () => void;
}) {
  const [memberId, setMemberId] = useState('');
  const [type, setType] = useState<SchParkingCommentType>('other');
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    if (!memberId) return;
    onSubmit({ id: generateId(), createdAt: new Date().toISOString(), memberId, type, message: message.trim() || undefined });
  };

  const types = Object.entries(COMMENT_TYPE_CFG) as [SchParkingCommentType, typeof COMMENT_TYPE_CFG[SchParkingCommentType]][];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg mx-auto bg-slate-800 rounded-t-2xl shadow-2xl" onPointerDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-700">
          <h3 className="text-sm font-bold text-white">🅿️ 駐車場について連絡する</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-700 text-lg leading-none">×</button>
        </div>
        <div className="px-4 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* ① 投稿者 */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">① 投稿者を選択</label>
            <div className="grid grid-cols-2 gap-1.5">
              {members.map(m => (
                <button key={m.id} type="button" onClick={() => setMemberId(m.id)}
                  className={`text-xs px-3 py-2 rounded-xl border text-left transition-colors ${memberId === m.id ? 'bg-blue-600/40 border-blue-500/50 text-blue-200' : 'border-slate-600 text-slate-300 hover:border-slate-500'}`}>
                  #{m.number} {m.nameKana || m.name}
                </button>
              ))}
            </div>
          </div>
          {/* ② 種別 */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">② コメント種別</label>
            <div className="space-y-1.5">
              {types.map(([key, cfg]) => (
                <button key={key} type="button" onClick={() => setType(key)}
                  className={`w-full text-left text-xs px-3 py-2.5 rounded-xl border transition-colors ${type === key ? cfg.color : 'border-slate-600 text-slate-300 hover:border-slate-500'}`}>
                  {cfg.icon} {cfg.label}
                </button>
              ))}
            </div>
          </div>
          {/* ③ メッセージ */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">③ コメント（任意）</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder="詳細があれば入力してください" rows={3}
              className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none placeholder-slate-500 resize-none" />
          </div>
          <button type="button" disabled={!memberId} onClick={handleSubmit}
            className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-sky-500 to-cyan-600 text-white disabled:opacity-40 active:scale-95 transition-transform">
            送信
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- ParkingCommentSection ----
function ParkingCommentSection({
  comments, members, isAdmin, onSave,
}: {
  comments: SchParkingComment[];
  members: SchMember[];
  isAdmin: boolean;
  onSave: (c: SchParkingComment[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const sortedMembers = useMemo(() => [...members].sort((a, b) => a.number - b.number), [members]);
  const getMember = (id: string) => members.find(m => m.id === id);
  const unresolved = comments.filter(c => !c.resolved);
  const resolved = comments.filter(c => c.resolved);

  const resolve = (id: string) => onSave(comments.map(c => c.id === id ? { ...c, resolved: true } : c));
  const deleteComment = (id: string) => onSave(comments.filter(c => c.id !== id));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[11px] font-bold text-sky-400/70 uppercase tracking-wider flex items-center gap-1.5">
          💬 駐車場連絡
          {unresolved.length > 0 && (
            <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">{unresolved.length}</span>
          )}
        </h2>
        <button onClick={() => setShowForm(true)}
          className="text-xs text-sky-400 hover:text-sky-200 px-3 py-1.5 rounded-lg border border-sky-500/30 hover:border-sky-400/50">
          ＋ 連絡を追加
        </button>
      </div>

      {comments.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-3">スキップ/使わせて欲しい/不具合かも など連絡</p>
      ) : (
        <div className="space-y-2">
          {unresolved.map(c => {
            const member = getMember(c.memberId);
            const cfg = COMMENT_TYPE_CFG[c.type] ?? COMMENT_TYPE_CFG.other;
            return (
              <div key={c.id} className="bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
                  {member && <span className="text-xs text-slate-400">#{member.number} {member.nameKana || member.name}</span>}
                  <span className="text-[10px] text-slate-600 ml-auto">
                    {new Date(c.createdAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} {new Date(c.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {c.message && <p className="text-sm text-white leading-relaxed">{c.message}</p>}
                {isAdmin && (
                  <div className="flex gap-2 pt-0.5">
                    <button onClick={() => resolve(c.id)} className="text-[10px] text-emerald-400 hover:text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/40 hover:border-emerald-400/60 transition-colors">✓ 解決済み</button>
                    <button onClick={() => deleteComment(c.id)} className="text-[10px] text-slate-500 hover:text-red-400 px-2 py-0.5 rounded border border-slate-700 hover:border-red-500/30 transition-colors">削除</button>
                  </div>
                )}
              </div>
            );
          })}
          {resolved.length > 0 && (
            <details>
              <summary className="text-[10px] text-slate-600 cursor-pointer select-none py-1">解決済み {resolved.length}件</summary>
              <div className="space-y-1.5 mt-1.5 opacity-50">
                {resolved.map(c => {
                  const member = getMember(c.memberId);
                  const cfg = COMMENT_TYPE_CFG[c.type] ?? COMMENT_TYPE_CFG.other;
                  return (
                    <div key={c.id} className="bg-slate-800/40 border border-white/5 rounded-xl px-3 py-2 flex items-center gap-2">
                      <span className="text-[9px] text-slate-600 line-through">{cfg.label}</span>
                      {member && <span className="text-[10px] text-slate-600">#{member.number}</span>}
                      {isAdmin && <button onClick={() => deleteComment(c.id)} className="ml-auto text-[9px] text-slate-600 hover:text-red-400">削除</button>}
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}

      {showForm && (
        <ParkingCommentForm
          members={sortedMembers}
          onSubmit={(c) => { onSave([c, ...comments]); setShowForm(false); }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

// ---- HomeSection ----
function HomeSection({
  events, members, parkingRecords, parkingRotation, nearbyParking, announcements,
  isAdmin, parkingComments, onSaveParkingComments,
  onGoToAnnounce, onGoToEvent, onGoToVideo,
  onSkip, onUnskip, onMarkUsed, onMarkPending, onSaveHistory, onUpdateMaxSlots,
}: {
  events: SchEvent[];
  members: SchMember[];
  parkingRecords: SchParkingRecord[];
  parkingRotation: number;
  nearbyParking: SchNearbyParking[];
  announcements: SchAnnouncement[];
  isAdmin: boolean;
  parkingComments: SchParkingComment[];
  onSaveParkingComments: (c: SchParkingComment[]) => void;
  onGoToAnnounce: () => void;
  onGoToEvent: (id: string) => void;
  onGoToVideo: () => void;
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
  const [weather, setWeather] = useState<{ code: number; maxTemp: number; minTemp: number; precip: number; place: string } | null>(null);

  const upcomingEvents = useMemo(
    () => events.filter(e => !isEventPast(e)).sort((a, b) => a.date.localeCompare(b.date)),
    [events, today]
  );
  const nextEvent = upcomingEvents[0];
  const nextNextEvent = upcomingEvents[1];

  useEffect(() => {
    if (!nextEvent?.weatherArea) { setWeather(null); return; }
    // 進行中のイベントは今日の天気、未来のイベントは開始日の天気
    const weatherDate = (today >= nextEvent.date && today <= (nextEvent.endDate ?? nextEvent.date))
      ? today : nextEvent.date;
    const iso = weatherDate.replace(/\//g, '-');
    const area = nextEvent.weatherArea;

    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(area)}&format=json&limit=1&countrycodes=jp&accept-language=ja&addressdetails=1&featuretype=settlement`,
      { headers: { 'User-Agent': 'SCHSoccerApp/1.0' } }
    )
      .then(r => r.json())
      .then((results: any[]) => {
        const r = results[0];
        const lat = r ? parseFloat(r.lat) : null;
        const lon = r ? parseFloat(r.lon) : null;
        if (!lat || !lon) { setWeather(null); return; }
        const addr = r.address ?? {};
        const place = addr.city ?? addr.town ?? addr.county ?? addr.state ?? area;
        return fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
          `&timezone=Asia%2FTokyo&start_date=${iso}&end_date=${iso}`
        )
          .then(r2 => r2.json())
          .then((d: any) => {
            const daily = d.daily;
            if (!daily) { setWeather(null); return; }
            setWeather({
              code:    daily.weather_code[0],
              maxTemp: Math.round(daily.temperature_2m_max[0]),
              minTemp: Math.round(daily.temperature_2m_min[0]),
              precip:  daily.precipitation_probability_max[0] ?? 0,
              place,
            });
          });
      })
      .catch(() => setWeather(null));
  }, [nextEvent?.date, nextEvent?.endDate, nextEvent?.weatherArea, today]);

  const toEventItem = (e: SchEvent): EventItem => ({
    id: e.id,
    date: e.date,
    endDate: e.endDate,
    endTime: e.endTime,
    type: e.type,
    label: e.type === 'match' ? (() => { const opp = getMatches(e)[0]?.opponentName || e.opponentName; return opp ? `🆚 ${opp}` : '相手未定'; })() : (e.label || e.location || tc(e.type).label),
    maxSlots: e.type === 'off' ? 0 : (e.maxParkingSlots ?? DEFAULT_MAX_SLOTS),
  });

  const allEventItems: EventItem[] = useMemo(
    () => [...events].sort((a, b) => a.date.localeCompare(b.date)).map(toEventItem),
    [events]
  );

  const pastEvents = useMemo(
    () => [...events]
      .filter(e => e.date < today && e.type !== 'off' && e.maxParkingSlots !== 0)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10),
    [events, today]
  );

  const parkingPlan = useMemo(
    () => buildParkingPlan(sortedMembers, allEventItems, parkingRotation, parkingRecords)
            .filter(p => !isEventPast(p) && p.maxSlots !== 0),
    [sortedMembers, allEventItems, parkingRotation, parkingRecords]
  );

  return (
    <div className="space-y-5">
      {/* チャンネル最新動画（コンパクトストリップ） */}
      <HomeYtStrip onGoToVideo={onGoToVideo} />

      {/* Next event */}
      <div>
        <h2 className="text-[11px] font-bold text-sky-400/70 uppercase tracking-wider mb-2">次の予定</h2>
        {nextEvent ? (
          <div className={`rounded-2xl border ${tc(nextEvent.type).border} ${tc(nextEvent.type).bg} overflow-hidden`}>
            <div className="flex">
              {/* メインコンテンツ（タップで予定タブへ） */}
              <div className="flex-1 p-4 flex items-start gap-3 min-w-0 cursor-pointer active:opacity-80" onClick={() => onGoToEvent(nextEvent.id)}>
                {(() => {
                  const rel = relativeDayLabel(nextEvent.date, today);
                  const multiDay = (() => {
                    if (!nextEvent.endDate || nextEvent.endDate === nextEvent.date) return null;
                    const s = new Date(nextEvent.date.replace(/\//g, '-'));
                    const e = new Date(nextEvent.endDate.replace(/\//g, '-'));
                    const t = new Date(today.replace(/\//g, '-'));
                    const total = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
                    const current = t >= s && t <= e ? Math.round((t.getTime() - s.getTime()) / 86400000) + 1 : null;
                    return { total, current };
                  })();
                  return (
                    <div className="text-center px-3 py-2 rounded-xl min-w-[56px] bg-black/20 text-white flex-shrink-0">
                      <p className="text-[10px] leading-tight text-slate-300">{nextEvent.date.slice(5)}</p>
                      <p className="text-lg font-extrabold leading-tight">{dayLabel(nextEvent.date)}</p>
                      <p className={`text-[10px] font-bold leading-tight mt-0.5 ${rel.color}`}>{rel.label}</p>
                      {multiDay && (
                        <p className="text-[10px] font-bold leading-tight mt-0.5 text-amber-300">
                          {multiDay.current ? `${multiDay.current}/` : ''}{multiDay.total}日目
                        </p>
                      )}
                    </div>
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tc(nextEvent.type).badge}`}>
                    {tc(nextEvent.type).icon} {tc(nextEvent.type).label}
                  </span>
                  {nextEvent.type === 'match' ? (() => {
                    const ms = getMatches(nextEvent);
                    const first = ms[0];
                    const oppText = ms.length > 1
                      ? (first?.opponentName ? `🆚 ${first.opponentName} ほか${ms.length - 1}試合` : `${ms.length}試合`)
                      : (first?.opponentName ? `🆚 ${first.opponentName}` : '相手未定');
                    return (
                      <>
                        {nextEvent.label && <p className="text-base font-bold text-white mt-1.5 truncate">🏆 {nextEvent.label}</p>}
                        <p className={`${nextEvent.label ? 'text-sm text-slate-300 mt-0.5' : 'text-base font-bold text-white mt-1.5'} truncate`}>{oppText}</p>
                      </>
                    );
                  })() : (
                    <p className="text-base font-bold text-white mt-1.5 truncate">{nextEvent.label || nextEvent.location || (nextEvent.type === 'off' ? nextEvent.note : undefined) || '詳細未定'}</p>
                  )}
                  {nextEvent.startTime && <p className="text-sm text-slate-300 mt-0.5">⏰ {nextEvent.startTime}{nextEvent.endTime ? ` 〜 ${nextEvent.endTime}` : ''}</p>}
                  {nextEvent.location && <p className="text-xs text-slate-400 mt-0.5">📍 {nextEvent.location}</p>}
                  {weather && (
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(weather.place + ' 天気')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 mt-1.5 px-2 py-1.5 rounded-xl bg-black/20 border border-white/10 active:opacity-70"
                    >
                      <span className="text-xl leading-none">{weatherEmoji(weather.code, weather.precip)}</span>
                      <span className="text-sm font-bold text-white">{weatherLabel(weather.code, weather.precip)}</span>
                      <span className="text-xs text-blue-300">{weather.minTemp}°</span>
                      <span className="text-xs text-slate-400">/</span>
                      <span className="text-xs text-red-300">{weather.maxTemp}°C</span>
                      <span className="text-xs text-cyan-300 font-semibold">☔ {weather.precip}%</span>
                      <span className="ml-auto text-[10px] text-slate-500">📍{weather.place} →</span>
                    </a>
                  )}
                  {(nextEvent.meetingTime || nextEvent.meetingPlace) && (
                    <p className="text-sm font-semibold text-amber-300 mt-1">
                      🚩 集合{nextEvent.meetingTime ? ` ${nextEvent.meetingTime}` : ''}{nextEvent.meetingPlace ? <span className="text-xs font-medium"> {nextEvent.meetingPlace}</span> : ''}
                    </p>
                  )}
                </div>
              </div>
              {/* 矢印アイコン */}
              <div className="w-8 flex-shrink-0 grid place-items-center border-l border-white/10 text-slate-500 text-xs pointer-events-none">›</div>
            </div>
            {/* 添付画像ストリップ */}
            {nextEvent.images && nextEvent.images.length > 0 && (
              <div className="border-t border-white/10 px-3 py-2">
                <EventImageGallery images={nextEvent.images} />
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl p-5 border bg-slate-800/40 border-white/5 text-center text-slate-400 text-sm">予定がありません</div>
        )}
      </div>

      {/* Next next event */}
      {nextNextEvent && (
        <div>
          <h2 className="text-[11px] font-bold text-sky-400/70 uppercase tracking-wider mb-2">次の次の予定</h2>
          <div
            className={`rounded-2xl border ${tc(nextNextEvent.type).border} ${tc(nextNextEvent.type).bg} overflow-hidden cursor-pointer active:opacity-80`}
            onClick={() => onGoToEvent(nextNextEvent.id)}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              {/* 日付バッジ */}
              <div className="text-center px-2.5 py-1.5 rounded-xl min-w-[48px] bg-black/20 text-white flex-shrink-0">
                <p className="text-[10px] leading-tight text-slate-300">{nextNextEvent.date.slice(5)}</p>
                <p className="text-base font-extrabold leading-tight">{dayLabel(nextNextEvent.date)}</p>
                <p className={`text-[9px] font-bold leading-tight mt-0.5 ${relativeDayLabel(nextNextEvent.date, today).color}`}>
                  {relativeDayLabel(nextNextEvent.date, today).label}
                </p>
              </div>
              {/* 内容 */}
              <div className="flex-1 min-w-0">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tc(nextNextEvent.type).badge}`}>
                  {tc(nextNextEvent.type).icon} {tc(nextNextEvent.type).label}
                </span>
                {nextNextEvent.type === 'match' ? (() => {
                  const ms = getMatches(nextNextEvent);
                  const first = ms[0];
                  const oppText = ms.length > 1
                    ? (first?.opponentName ? `🆚 ${first.opponentName} ほか${ms.length - 1}試合` : `${ms.length}試合`)
                    : (first?.opponentName ? `🆚 ${first.opponentName}` : '相手未定');
                  return (
                    <>
                      {nextNextEvent.label && <p className="text-sm font-bold text-white mt-1 truncate">🏆 {nextNextEvent.label}</p>}
                      <p className={`${nextNextEvent.label ? 'text-xs text-slate-300 mt-0.5' : 'text-sm font-bold text-white mt-1'} truncate`}>{oppText}</p>
                    </>
                  );
                })() : (
                  <p className="text-sm font-bold text-white mt-1 truncate">{nextNextEvent.label || nextNextEvent.location || (nextNextEvent.type === 'off' ? nextNextEvent.note : undefined) || '詳細未定'}</p>
                )}
                <div className="flex flex-wrap gap-x-3 mt-0.5">
                  {nextNextEvent.startTime && <p className="text-xs text-slate-300">⏰ {nextNextEvent.startTime}{nextNextEvent.endTime ? ` 〜 ${nextNextEvent.endTime}` : ''}</p>}
                  {nextNextEvent.location && <p className="text-xs text-slate-400 truncate">📍 {nextNextEvent.location}</p>}
                </div>
                {(nextNextEvent.meetingTime || nextNextEvent.meetingPlace) && (
                  <p className="text-xs font-semibold text-amber-300 mt-0.5">
                    🚩 集合{nextNextEvent.meetingTime ? ` ${nextNextEvent.meetingTime}` : ''}{nextNextEvent.meetingPlace ? ` ${nextNextEvent.meetingPlace}` : ''}
                  </p>
                )}
              </div>
              <span className="text-slate-500 text-xs flex-shrink-0">›</span>
            </div>
            {nextNextEvent.images && nextNextEvent.images.length > 0 && (
              <div className="border-t border-white/10 px-3 py-2">
                <EventImageGallery images={nextNextEvent.images} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 最近のお知らせ（過去14日以内・最大3件） */}
      {(() => {
        if (announcements.length === 0) return null;
        // Sort newest first (createdAt preferred, fallback to date)
        const sorted = [...announcements].sort((a, b) => {
          const ta = a.createdAt ?? a.date;
          const tb = b.createdAt ?? b.date;
          return tb.localeCompare(ta);
        });
        const cutoff = (() => {
          const d = new Date(today.replace(/\//g, '-'));
          d.setDate(d.getDate() - 14);
          return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
        })();
        // 過去14日以内のみ表示（最大3件）
        const shown = sorted.filter(a => a.date >= cutoff).slice(0, 3);
        if (shown.length === 0) return null;
        const hasMore = announcements.length > shown.length;
        return (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[11px] font-bold text-sky-400/70 uppercase tracking-wider">📢 最近のお知らせ</h2>
              {hasMore && (
                <button onClick={onGoToAnnounce} className="text-[10px] text-sky-400 hover:text-sky-300">
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
                        {isExpanded && a.url && !isInstagramUrl(a.url) && <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 hover:underline mt-1 block truncate">{a.url}</a>}
                        {!isExpanded && a.checkItems && a.checkItems.length > 0 && <p className="text-xs text-amber-300 mt-0.5">🎒 持ち物リストあり（{a.checkItems.length}件）</p>}
                        {!isExpanded && a.url && isInstagramUrl(a.url) && <p className="text-xs text-sky-400 mt-0.5">📸 Instagram投稿あり</p>}
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
                  className="w-full text-xs py-2.5 rounded-xl border border-dashed border-sky-500/30 text-sky-400/60 hover:text-sky-200 hover:border-sky-400/60 transition-colors">
                  他 {announcements.length - shown.length} 件のお知らせを見る
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Parking comment section */}
      <ParkingCommentSection
        comments={parkingComments}
        members={members}
        isAdmin={isAdmin}
        onSave={onSaveParkingComments}
      />

      {/* Parking forecast */}
      <div>
        <h2 className="text-[11px] font-bold text-sky-400/70 uppercase tracking-wider mb-2">🅿️ 駐車場予定</h2>
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
                isAdmin={isAdmin}
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
          <h2 className="text-[11px] font-bold text-sky-400/70 uppercase tracking-wider mb-2">🗺️ 近隣駐車場</h2>
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
          isAdmin={isAdmin}
          onSaveHistory={onSaveHistory}
        />
      )}

      {/* 戦歴バナー */}
      <Link href="/sch/history"
        className="flex items-center gap-3 bg-gradient-to-r from-sky-600 to-cyan-500 rounded-2xl px-4 py-3 shadow hover:from-sky-700 hover:to-cyan-600 transition-all active:scale-95"
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
        {event.note && <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap">{event.note}</p>}
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
function AnnounceSection({ announcements, onSave, events, isAdmin }: { announcements: SchAnnouncement[]; onSave: (a: SchAnnouncement[], notifyLine: boolean) => void; events: SchEvent[]; isAdmin?: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SchAnnouncement | null>(null);
  const [date, setDate] = useState(todayStr());
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [important, setImportant] = useState(false);
  const [url, setUrl] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<SchEvent | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [showLineModal, setShowLineModal] = useState(false);
  const [lineMessage, setLineMessage] = useState('');
  const [lineSending, setLineSending] = useState(false);
  const [lineResult, setLineResult] = useState<'ok' | 'error' | null>(null);
  const [checkItems, setCheckItems] = useState<{ text: string; note: string }[]>([]);
  const [showCheckItems, setShowCheckItems] = useState(false);
  const [notifyLine, setNotifyLine] = useState(true);

  const resetForm = () => {
    setDate(todayStr()); setTitle(''); setContent(''); setImportant(false); setUrl('');
    setEditing(null); setShowForm(false); setSelectedEvent(null); setShowAllEvents(false);
    setCheckItems([]); setShowCheckItems(false); setNotifyLine(true);
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
    onSave(updated, notifyLine);
    resetForm();
  };
  const handleDelete = (id: string) => { if (window.confirm('削除しますか？')) onSave(announcements.filter(a => a.id !== id), false); };
  const handleLineSend = async () => {
    if (!lineMessage.trim()) return;
    setLineSending(true);
    setLineResult(null);
    try {
      const res = await fetch('/api/admin/line-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: lineMessage.trim() }),
      });
      setLineResult(res.ok ? 'ok' : 'error');
      if (res.ok) { setLineMessage(''); setTimeout(() => { setShowLineModal(false); setLineResult(null); }, 1200); }
    } catch {
      setLineResult('error');
    } finally {
      setLineSending(false);
    }
  };
  const sorted = [...announcements];

  return (
    <div className="space-y-3">
      <button onClick={() => setShowForm(true)} className="w-full bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
        <span className="text-lg">＋</span> 連絡を投稿
      </button>
      {isAdmin && (
        <button onClick={() => { setShowLineModal(true); setLineResult(null); }} className="w-full bg-gradient-to-r from-emerald-600 to-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
          <span className="text-base">📣</span> 管理者用LINE通知
        </button>
      )}
      {showLineModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowLineModal(false)}>
          <div className="bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">📣 管理者用LINE通知</h3>
                <button onClick={() => setShowLineModal(false)} className="text-slate-400 text-2xl">&times;</button>
              </div>
              <p className="text-xs text-slate-400">チームLINEグループに直接メッセージを送信します。</p>
              <textarea
                value={lineMessage}
                onChange={e => setLineMessage(e.target.value)}
                placeholder="送信するメッセージを入力..."
                rows={5}
                className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-emerald-400 focus:outline-none placeholder-slate-500 resize-none"
              />
              {lineResult === 'ok' && <p className="text-emerald-400 text-sm text-center font-bold">✓ 送信しました</p>}
              {lineResult === 'error' && <p className="text-red-400 text-sm text-center">送信に失敗しました</p>}
              <div className="flex gap-3">
                <button onClick={() => setShowLineModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm font-semibold">キャンセル</button>
                <button
                  onClick={handleLineSend}
                  disabled={lineSending || !lineMessage.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform"
                >
                  {lineSending ? '送信中...' : '送信する'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
                              className="w-full text-left text-xs px-3 py-2 rounded-lg bg-slate-700/60 hover:bg-sky-700/40 border border-transparent hover:border-sky-500/50 text-slate-300 hover:text-white transition-colors flex items-center gap-2"
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
                            className="w-full text-xs py-1.5 text-slate-500 hover:text-sky-400 transition-colors"
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
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={notifyLine} onChange={e => setNotifyLine(e.target.checked)} className="w-4 h-4 accent-green-500" /><span className="text-sm text-slate-300">💬 LINE通知</span></label>
                <button type="submit" className="w-full bg-gradient-to-r from-sky-500 to-cyan-600 text-white font-bold py-3 rounded-xl text-sm">投稿</button>
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
                  {a.url && !isInstagramUrl(a.url) && <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 hover:underline mt-1 block truncate">{a.url}</a>}
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
  isAdmin, onAddAnnouncement,
  events, parkingRecords,
}: {
  members: SchMember[];
  onSaveMember: (m: SchMember[]) => void;
  nearbyParking: SchNearbyParking[];
  onSaveNearbyParking: (p: SchNearbyParking[]) => void;
  parkingRotation: number;
  onResetRotation: (index: number) => void;
  teamLogo: string | null;
  onSaveTeamLogo: (logo: string | null) => void;
  isAdmin?: boolean;
  onAddAnnouncement?: (ann: SchAnnouncement) => void;
  events?: SchEvent[];
  parkingRecords?: SchParkingRecord[];
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
  const [rotationConfirm, setRotationConfirm] = useState<{ index: number; memberName: string; newRotation: number } | null>(null);

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

  // Compute full parking plan (all events) to derive correct rotation display
  const allEventItemsForRotation: EventItem[] = useMemo(
    () => [...(events ?? [])].sort((a, b) => a.date.localeCompare(b.date)).map(e => ({
      id: e.id, date: e.date, endDate: e.endDate, endTime: e.endTime, type: e.type,
      label: e.label || e.type,
      maxSlots: e.type === 'off' ? 0 : (e.maxParkingSlots ?? DEFAULT_MAX_SLOTS),
    })),
    [events]
  );
  const [fullParkingPlan, pastConsumed] = useMemo(() => {
    const plan = buildParkingPlan(sorted, allEventItemsForRotation, parkingRotation, parkingRecords ?? []);
    const consumed = plan.filter(p => isEventPast(p)).reduce((sum, p) => sum + p.consumedCount, 0);
    return [plan, consumed] as const;
  }, [sorted, allEventItemsForRotation, parkingRotation, parkingRecords]);
  const nextParkingEntry = fullParkingPlan.find(p => !isEventPast(p) && p.maxSlots > 0);
  const nextMember = nextParkingEntry
    ? sorted[nextParkingEntry.rotationStartIndex % Math.max(sorted.length, 1)]
    : null;

  return (
    <div className="space-y-6">
      {/* Member list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[11px] font-bold text-sky-400/70 uppercase tracking-wider">メンバー</h2>
          <button onClick={() => setShowMemberForm(true)} className="text-xs text-sky-400 hover:text-sky-200 px-3 py-1.5 rounded-lg border border-sky-500/30 hover:border-sky-400/50">＋ 追加</button>
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

      {/* Parking rotation — admin only */}
      {isAdmin && (
        <div>
          <h2 className="text-[11px] font-bold text-sky-400/70 uppercase tracking-wider mb-2">🅿️ ローテーション管理</h2>
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
                    onClick={() => {
                      const n = sorted.length;
                      const nr = n > 0 ? ((i - (pastConsumed % n)) % n + n) % n : 0;
                      setRotationConfirm({ index: i, memberName: `#${m.number} ${m.nameKana || m.name}`, newRotation: nr });
                    }}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${nextParkingEntry?.rotationStartIndex === i ? 'bg-sky-600/60 border-sky-500/60 text-white' : 'border-slate-600 text-slate-400 hover:border-sky-500/40 hover:text-white'}`}
                  >
                    #{m.number}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rotation confirm dialog */}
      {rotationConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4" onClick={e => { if (e.target === e.currentTarget) setRotationConfirm(null); }}>
          <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm border border-white/10 shadow-2xl space-y-4" onPointerDown={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">ローテーションを変更</h3>
            <p className="text-sm text-slate-300">{rotationConfirm.memberName} から開始するよう変更します。</p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  onResetRotation(rotationConfirm.newRotation);
                  const today = todayStr();
                  const ann: SchAnnouncement = {
                    id: `parking-rotation-${Date.now()}`,
                    date: today,
                    title: '🅿️ 駐車場順番を変更しました',
                    content: `駐車場のローテーションを調整しました。\n次回は ${rotationConfirm.memberName} から開始となります。\nご確認ください。`,
                    important: false,
                    createdAt: new Date().toISOString(),
                  };
                  onAddAnnouncement?.(ann);
                  setRotationConfirm(null);
                }}
                className="w-full py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-sky-500 to-cyan-600 text-white"
              >
                変更して連絡に追加
              </button>
              <button
                onClick={() => { onResetRotation(rotationConfirm.newRotation); setRotationConfirm(null); }}
                className="w-full py-2.5 rounded-xl font-bold text-sm border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500"
              >
                変更のみ（連絡に追加しない）
              </button>
              <button onClick={() => setRotationConfirm(null)} className="w-full py-2 text-xs text-slate-500 hover:text-slate-400">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nearby parking */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[11px] font-bold text-sky-400/70 uppercase tracking-wider">🗺️ 近隣駐車場</h2>
          <button onClick={() => setShowParkingForm(true)} className="text-xs text-sky-400 hover:text-sky-200 px-3 py-1.5 rounded-lg border border-sky-500/30 hover:border-sky-400/50">＋ 追加</button>
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
        <h2 className="text-[11px] font-bold text-sky-400/70 uppercase tracking-wider mb-2">🏅 チームロゴ</h2>
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
                <button type="submit" className="w-full bg-gradient-to-r from-sky-500 to-cyan-600 text-white font-bold py-3 rounded-xl text-sm">保存</button>
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
                <button type="submit" className="w-full bg-gradient-to-r from-sky-500 to-cyan-600 text-white font-bold py-3 rounded-xl text-sm">保存</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main Page ----
type Tab = 'home' | 'events' | 'video' | 'stats' | 'announce' | 'member';

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
  const [parkingComments, setParkingComments] = useState<SchParkingComment[]>([]);
  const [teamLogo, setTeamLogo] = useState<string | null>(null);
  const [updateHistory, setUpdateHistory] = useState<SchUpdateHistory[]>([]);
  const [standaloneVideos, setStandaloneVideos] = useState<SchStandaloneVideo[]>([]);
  const [videoThumbnails, setVideoThumbnails] = useState<Record<string, string>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [swipedHistId, setSwipedHistId] = useState<string | null>(null);
  const [scrollTarget, setScrollTarget] = useState<{ tab: Tab; itemId: string } | null>(null);
  const [openDetailId, setOpenDetailId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pushState, setPushState] = useState<'loading' | 'unsupported' | 'default' | 'subscribed' | 'denied'>('loading');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  // 編集履歴モーダル
  interface HistoryModal { editEntries: SchUpdateHistory[]; autoEntries: SchUpdateHistory[]; baseHistory: SchUpdateHistory[]; memo: string; previousEvents?: SchEvent[]; previousAnnouncements?: SchAnnouncement[]; newEvents?: SchEvent[]; newAnnouncements?: SchAnnouncement[]; notifyLine?: boolean; }
  const [historyModal, setHistoryModal] = useState<HistoryModal | null>(null);

  useEffect(() => {
    fetch('/api/admin/logs?limit=1').then(r => { if (r.ok) setIsAdmin(true); }).catch(() => {});
  }, []);

  // URLパラメータ ?tab=xxx でタブを初期化（LINE通知からの直リンク対応）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab') as Tab | null;
    const validTabs: Tab[] = ['home', 'events', 'video', 'stats', 'announce', 'member'];
    if (t && validTabs.includes(t)) setTab(t);
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
      setParkingComments(d.parkingComments ?? []);
      setTeamLogo(d.teamLogo ?? null);
      setUpdateHistory(d.updateHistory ?? []);
      setStandaloneVideos(d.standaloneVideos ?? []);
      setVideoThumbnails(d.videoThumbnails ?? {});
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  const post = useCallback((body: object, notifyLine?: boolean) => {
    const payload = notifyLine !== undefined ? { ...body, notifyLine } : body;
    fetch('/api/sch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(console.error);
  }, []);

  const saveEvents = useCallback((e: SchEvent[], notifyLine?: boolean) => {
    setEvents(e);
    const oldMap = new Map(events.map(ev => [ev.id, ev]));
    const getEvTitle = (ev: SchEvent) => {
      if (ev.type === 'match') { const opp = ev.matches?.[0]?.opponentName || ev.opponentName; return opp ? `vs ${opp}` : '試合'; }
      return ev.label || ev.location || tc(ev.type).label;
    };
    const newIds = new Set(e.map(ev => ev.id));
    const autoEntries: SchUpdateHistory[] = [];
    const editEntries: SchUpdateHistory[] = [];
    for (const ev of e) {
      const old = oldMap.get(ev.id);
      if (!old) autoEntries.push({ id: generateId(), timestamp: new Date().toISOString(), type: 'event', eventType: ev.type, title: getEvTitle(ev), action: 'new', itemId: ev.id, tab: 'events' });
      else if (JSON.stringify(old) !== JSON.stringify(ev)) editEntries.push({ id: generateId(), timestamp: new Date().toISOString(), type: 'event', eventType: ev.type, title: getEvTitle(ev), action: 'edit', itemId: ev.id, tab: 'events' });
    }
    for (const old of events) {
      if (!newIds.has(old.id)) autoEntries.push({ id: generateId(), timestamp: new Date().toISOString(), type: 'event', eventType: old.type, title: getEvTitle(old), action: 'delete', itemId: old.id, tab: 'events' });
    }
    if (editEntries.length > 0) {
      // 編集の場合は POST を遅延: モーダルのボタンで notifyLine を決定する
      setHistoryModal({ editEntries, autoEntries, baseHistory: updateHistory, memo: '', previousEvents: events, newEvents: e, notifyLine: notifyLine ?? false });
    } else {
      post({ events: e }, notifyLine);
      if (autoEntries.length > 0) {
        const h = [...autoEntries, ...updateHistory].slice(0, 20);
        setUpdateHistory(h); post({ updateHistory: h });
      }
    }
  }, [post, events, updateHistory]);

  const saveAnnounce = useCallback((a: SchAnnouncement[], notifyLine?: boolean) => {
    setAnnouncements(a);
    const oldMap = new Map(announcements.map(ann => [ann.id, ann]));
    const newIds = new Set(a.map(ann => ann.id));
    const autoEntries: SchUpdateHistory[] = [];
    const editEntries: SchUpdateHistory[] = [];
    for (const ann of a) {
      const old = oldMap.get(ann.id);
      if (!old) autoEntries.push({ id: generateId(), timestamp: new Date().toISOString(), type: 'announcement', title: ann.title, action: 'new', itemId: ann.id, tab: 'announce' });
      else if (JSON.stringify(old) !== JSON.stringify(ann)) editEntries.push({ id: generateId(), timestamp: new Date().toISOString(), type: 'announcement', title: ann.title, action: 'edit', itemId: ann.id, tab: 'announce' });
    }
    for (const old of announcements) {
      if (!newIds.has(old.id)) autoEntries.push({ id: generateId(), timestamp: new Date().toISOString(), type: 'announcement', title: old.title, action: 'delete', itemId: old.id, tab: 'announce' });
    }
    if (editEntries.length > 0) {
      // 編集の場合は POST を遅延: モーダルのボタンで notifyLine を決定する
      setHistoryModal({ editEntries, autoEntries, baseHistory: updateHistory, memo: '', previousAnnouncements: announcements, newAnnouncements: a, notifyLine: notifyLine ?? false });
    } else {
      post({ announcements: a }, notifyLine);
      if (autoEntries.length > 0) {
        const h = [...autoEntries, ...updateHistory].slice(0, 20);
        setUpdateHistory(h); post({ updateHistory: h });
      }
    }
  }, [post, announcements, updateHistory]);
  const saveMembers         = useCallback((m: SchMember[])          => { setMembers(m);         post({ members: m }); }, [post]);
  const saveNearby          = useCallback((p: SchNearbyParking[])   => { setNearbyParking(p);   post({ nearbyParking: p }); }, [post]);
  const saveRotation        = useCallback((i: number)               => { setParkingRotation(i); post({ parkingRotation: i }); }, [post]);
  const saveRecords         = useCallback((r: SchParkingRecord[])   => { setParkingRecords(r);  post({ parkingRecords: r }); }, [post]);
  const saveParkingComments = useCallback((c: SchParkingComment[])  => { setParkingComments(c); post({ parkingComments: c }); }, [post]);
  const saveTeamLogo        = useCallback((logo: string | null)     => { setTeamLogo(logo);     post({ teamLogo: logo }); }, [post]);
  const saveStandaloneVideos = useCallback((v: SchStandaloneVideo[]) => { setStandaloneVideos(v); post({ standaloneVideos: v }); }, [post]);
  const saveVideoThumbnails  = useCallback((t: Record<string, string>) => { setVideoThumbnails(t); post({ videoThumbnails: t }); }, [post]);

  const upsertParkingRecord = useCallback((eventId: string, updater: (slots: SchParkingSlot[]) => SchParkingSlot[], notifyLine?: boolean) => {
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
      post({ parkingRecords: updated }, notifyLine);
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
    const notify = window.confirm('LINE通知を送りますか？');
    upsertParkingRecord(eventId, () => slots, notify);
  }, [upsertParkingRecord]);

  const handleUpdateMaxSlots = useCallback((eventId: string, maxSlots: number) => {
    setEvents(prev => {
      const updated = prev.map(e => e.id === eventId ? { ...e, maxParkingSlots: maxSlots } : e);
      post({ events: updated });
      return updated;
    });
  }, [post]);


  const tabs: { key: Tab; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { key: 'home',     label: 'ホーム',   Icon: HouseIcon    },
    { key: 'events',   label: '予定',     Icon: CalendarIcon },
    { key: 'video',    label: '動画',     Icon: VideoIcon    },
    { key: 'stats',    label: '戦績',     Icon: TrophyIcon   },
    { key: 'announce', label: '連絡',     Icon: BellIcon     },
    { key: 'member',   label: 'メンバー', Icon: PeopleIcon   },
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
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-sky-300 to-cyan-200 bg-clip-text text-transparent drop-shadow">SCH Info</h1>
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
                      : 'text-sky-400/70 border-sky-600/30 hover:text-sky-100 hover:border-sky-500/50'
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
                className="text-[10px] whitespace-nowrap text-sky-400/70 hover:text-sky-100 border border-sky-600/30 hover:border-sky-500/50 px-2.5 py-1 rounded-lg transition-colors"
                title="予定をカレンダーに追加"
              >
                📅 カレンダー追加
              </button>
              {isAdmin && (
                <a
                  href="/sch/admin"
                  className="text-[10px] whitespace-nowrap text-sky-400/70 hover:text-sky-100 border border-sky-600/30 hover:border-sky-500/50 px-2.5 py-1 rounded-lg transition-colors"
                >
                  🔍 管理
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Link href="/sch/history" className="flex items-center gap-1.5 text-[10px] text-sky-300/80 hover:text-white border border-sky-500/30 hover:border-sky-400/60 bg-sky-900/20 hover:bg-sky-900/40 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
            🏆 戦歴
          </Link>
          <Link href="/sch/ob" className="flex items-center gap-1.5 text-[10px] text-sky-300/80 hover:text-white border border-sky-500/30 hover:border-sky-400/60 bg-sky-900/20 hover:bg-sky-900/40 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
            ⚽ OB進路
          </Link>
          <Link href="/sch/kanagawa" className="flex items-center gap-1.5 text-[10px] text-sky-300/80 hover:text-white border border-sky-500/30 hover:border-sky-400/60 bg-sky-900/20 hover:bg-sky-900/40 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
            📊 神奈川県推移
          </Link>
        </div>
      </header>

      <div className="flex bg-white/5 backdrop-blur rounded-xl p-1 mb-5 border border-white/10">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg transition-all ${tab === key ? 'bg-gradient-to-b from-sky-500/50 to-cyan-600/50 text-sky-50 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Icon size={18} />
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
          <div className="mb-4 rounded-2xl bg-sky-950/50 border border-sky-500/20 overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
              onClick={() => setHistoryOpen(o => !o)}
            >
              <span className="text-lg">🔔</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white leading-tight">
                  {mm}月{dd}日 {hh}:{min} に更新がありました
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{latest.action === 'new' ? '新規投稿' : latest.action === 'delete' ? '削除' : '編集'}：{latest.title}</p>
              </div>
              <span className="text-slate-400 text-xs font-bold transition-transform" style={{ display: 'inline-block', transform: historyOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
            </button>
            {historyOpen && (
              <div className="border-t border-white/10">
                <p className="text-[10px] text-slate-500 px-4 pt-2 pb-1 font-bold uppercase tracking-wider">過去 {histItems.length} 件の更新</p>
                {histItems.map(h => {
                  const isSwiped = swipedHistId === h.id;
                  let touchStartX = 0;
                  return (
                    <div key={h.id} className="relative border-t border-white/5 overflow-hidden">
                      <div
                        className="absolute inset-y-0 right-0 flex items-center justify-center w-16 bg-red-600"
                        onClick={() => {
                          const next = updateHistory.filter(x => x.id !== h.id);
                          setUpdateHistory(next);
                          post({ updateHistory: next });
                          setSwipedHistId(null);
                        }}
                      >
                        <span className="text-white text-xs font-bold">削除</span>
                      </div>
                      <button
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 active:bg-white/10 transition-transform text-left bg-slate-800"
                        style={{ transform: isSwiped ? 'translateX(-64px)' : 'translateX(0)', transition: 'transform 0.2s' }}
                        onTouchStart={e => { touchStartX = e.touches[0].clientX; }}
                        onTouchEnd={e => {
                          const dx = e.changedTouches[0].clientX - touchStartX;
                          if (dx < -50) setSwipedHistId(h.id);
                          else if (dx > 20) setSwipedHistId(null);
                        }}
                        onClick={() => {
                          if (isSwiped) { setSwipedHistId(null); return; }
                          setHistoryOpen(false);
                          const targetTab: Tab = (h.type === 'event' && h.eventType === 'match') ? 'stats' : h.tab;
                          setTab(targetTab);
                          if (targetTab !== 'stats' && h.action !== 'delete') setScrollTarget({ tab: targetTab, itemId: h.itemId });
                        }}
                      >
                        <span className="text-base w-5 flex-shrink-0 text-center">{typeIcon(h)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-semibold truncate">{h.title}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            <span className={`font-bold mr-1.5 ${h.action === 'new' ? 'text-emerald-400' : h.action === 'delete' ? 'text-rose-400' : 'text-amber-400'}`}>{h.action === 'new' ? '新規' : h.action === 'delete' ? '削除' : '編集'}</span>
                            {h.changeMemo && <span className="text-slate-300 mr-1.5">「{h.changeMemo}」</span>}
                            {itemTs(h)}
                          </p>
                        </div>
                        <span className="text-slate-500 text-xs">›</span>
                      </button>
                    </div>
                  );
                })}
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
                    // 編集のみ保存：LINE通知なし で POST、autoEntries だけ履歴に追加
                    const { autoEntries, baseHistory, newEvents, newAnnouncements } = historyModal;
                    if (newEvents) post({ events: newEvents }, false);
                    if (newAnnouncements) post({ announcements: newAnnouncements }, false);
                    if (autoEntries.length > 0) { const h = [...autoEntries, ...baseHistory].slice(0, 20); setUpdateHistory(h); post({ updateHistory: h }); }
                    setHistoryModal(null);
                  }}
                >編集のみ保存</button>
                <button
                  className="flex-1 py-3 text-sm font-bold text-white bg-sky-600/30 hover:bg-sky-600/50 transition-colors"
                  onClick={() => {
                    const { editEntries, autoEntries, baseHistory, memo, newEvents, newAnnouncements } = historyModal;
                    if (newEvents) post({ events: newEvents }, true);
                    if (newAnnouncements) post({ announcements: newAnnouncements }, true);
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
                    // 戻る：POSTはまだしていないのでローカル state のみリバート
                    const { previousEvents, previousAnnouncements } = historyModal;
                    if (previousEvents) setEvents(previousEvents);
                    if (previousAnnouncements) setAnnouncements(previousAnnouncements);
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
          announcements={announcements} onGoToAnnounce={() => setTab('announce')} onGoToVideo={() => setTab('video')}
          isAdmin={isAdmin}
          parkingComments={parkingComments}
          onSaveParkingComments={saveParkingComments}
          onGoToEvent={(id) => { setTab('events'); setOpenDetailId(id); setScrollTarget({ tab: 'events', itemId: id }); }}
          onSkip={handleSkip} onUnskip={handleUnskip} onMarkUsed={handleMarkUsed} onMarkPending={handleMarkPending}
          onSaveHistory={handleSaveFullRecord}
          onUpdateMaxSlots={handleUpdateMaxSlots}
        />
      )}
      {tab === 'events' && (
        <EventSection events={events} members={members} onSave={saveEvents} openDetailId={openDetailId} />
      )}
      {tab === 'video' && (
        <VideoSection events={events} standaloneVideos={standaloneVideos} onSaveStandaloneVideos={saveStandaloneVideos} videoThumbnails={videoThumbnails} onSaveVideoThumbnails={saveVideoThumbnails} />
      )}
      {tab === 'stats' && (
        <StatsSection events={events} members={members} />
      )}
      {tab === 'announce' && (
        <AnnounceSection announcements={announcements} onSave={saveAnnounce} events={events} isAdmin={isAdmin} />
      )}
      {tab === 'member' && (
        <MemberSection
          members={members} onSaveMember={saveMembers}
          nearbyParking={nearbyParking} onSaveNearbyParking={saveNearby}
          parkingRotation={parkingRotation} onResetRotation={saveRotation}
          teamLogo={teamLogo} onSaveTeamLogo={saveTeamLogo}
          isAdmin={isAdmin}
          onAddAnnouncement={(ann) => saveAnnounce([ann, ...announcements])}
          events={events}
          parkingRecords={parkingRecords}
        />
      )}
    </>
  );
}
