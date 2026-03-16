'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  SchEvent, SchEventType, SchMatchType, SchMatchFormat, SchScorer,
  SchAnnouncement, SchMember, SchMemberParent, SchParkingRecord, SchParkingSlot, SchNearbyParking,
} from '@/lib/types';

// ---- Utilities ----
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}
const DAYS = ['日', '月', '火', '水', '木', '金', '土'];
function dayLabel(dateStr: string) {
  return DAYS[new Date(dateStr.replace(/\//g, '-')).getDay()];
}
function toInputDate(s: string) { return s.split('/').join('-'); }
function fromInputDate(s: string) { return s.split('-').join('/'); }

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

const MATCH_TYPES: SchMatchType[] = ['トレマ', '公式戦', 'CUP戦', 'その他'];
const MATCH_FORMATS: { value: SchMatchFormat; label: string }[] = [
  { value: 'friendly',          label: 'フレンドリー' },
  { value: 'tournament',        label: 'トーナメント' },
  { value: 'league_tournament', label: '予選+決勝T' },
];
const DEFAULT_MAX_SLOTS = 4;

// ---- Parking Logic ----
type EventItem = { id: string; date: string; type: string; label: string; maxSlots: number };
type EventPlan = EventItem & { slots: SchParkingSlot[]; rotationStartIndex: number; consumedCount: number };

function computeEventParking(
  sortedMembers: SchMember[],
  rotationIndex: number,
  skippedMemberIds: string[],
  maxSlots: number,
): { slots: SchParkingSlot[]; consumedCount: number } {
  const n = sortedMembers.length;
  if (n === 0) return { slots: [], consumedCount: 0 };
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
    ri = (ri + consumedCount) % Math.max(sortedMembers.length, 1);
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
  const today = todayStr();
  const isPast = plan.date < today;
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
            <div key={slot.memberId} className={`flex items-center gap-3 px-4 py-2.5 ${i < activeSlots.length - 1 ? 'border-b border-white/5' : ''}`}>
              <span className="text-slate-500 text-xs w-4 text-right">{i + 1}</span>
              <span className="w-9 text-center text-xs font-bold text-blue-300 bg-blue-900/30 rounded py-0.5">#{member.number}</span>
              <span className="text-white text-sm flex-1">{member.name}</span>
              {(slot.status === 'used' || slot.status === 'pending') && !isPast && (
                <div className="flex items-center gap-1">
                  {slot.status === 'used'
                    ? <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full">📅 使用予定</span>
                    : <span className="text-[10px] text-slate-500 px-1.5 py-0.5">─ 未使用</span>
                  }
                  {slot.status === 'pending' && (
                    <button
                      onClick={() => onMarkUsed(plan.id, slot.memberId)}
                      className="text-[10px] text-slate-500 hover:text-green-400 px-2 py-0.5 rounded border border-slate-700 hover:border-green-500/50 transition-colors"
                    >使用</button>
                  )}
                  <button
                    onClick={() => setSkipTarget(slot.memberId)}
                    className="text-[10px] text-slate-500 hover:text-amber-400 px-2 py-0.5 rounded border border-slate-700 hover:border-amber-500/50 transition-colors"
                  >スキップ</button>
                </div>
              )}
              {(slot.status === 'used' || slot.status === 'pending') && isPast && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${slot.status === 'used' ? 'bg-green-500/20 text-green-300' : 'text-slate-500'}`}>
                  {slot.status === 'used' ? '✓ 使用' : '─ 未使用'}
                </span>
              )}
            </div>
          );
        })}
      </div>}

      {/* Skipped */}
      {plan.maxSlots > 0 && skippedSlots.length > 0 && (
        <div className="bg-slate-800/30 border-t border-white/5 px-4 py-2 space-y-1">
          {skippedSlots.map(slot => {
            const member = getMember(slot.memberId);
            return (
              <div key={slot.memberId} className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 line-through">#{member?.number} {member?.name}</span>
                {slot.skipComment && <span className="text-slate-500 italic">「{slot.skipComment}」</span>}
                {!isPast && (
                  <button onClick={() => onUnskip(plan.id, slot.memberId)} className="ml-auto text-slate-400 hover:text-white text-[10px] px-1.5 py-0.5 rounded border border-slate-600 hover:border-slate-400 transition-colors">取消</button>
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
  members,
  onSave,
  onClose,
}: {
  initialEvent?: SchEvent;
  members: SchMember[];
  onSave: (event: SchEvent) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<SchEventType>(initialEvent?.type ?? 'practice');
  const [date, setDate] = useState(initialEvent?.date ?? todayStr());
  const [endDate, setEndDate] = useState(initialEvent?.endDate ?? '');
  const [startTime, setStartTime] = useState(initialEvent?.startTime ?? '');
  const [endTime, setEndTime] = useState(initialEvent?.endTime ?? '');
  const [location, setLocation] = useState(initialEvent?.location ?? '');
  const [label, setLabel] = useState(initialEvent?.label ?? '');
  const [note, setNote] = useState(initialEvent?.note ?? '');
  const initialParking = initialEvent?.maxParkingSlots ?? DEFAULT_MAX_SLOTS;
  const [parkingAvailable, setParkingAvailable] = useState(initialParking > 0);
  const [maxParkingSlots, setMaxParkingSlots] = useState(initialParking > 0 ? initialParking : DEFAULT_MAX_SLOTS);

  // Match fields
  const [matchType, setMatchType] = useState<SchMatchType>(initialEvent?.matchType ?? 'トレマ');
  const [matchFormat, setMatchFormat] = useState<SchMatchFormat>(initialEvent?.matchFormat ?? 'friendly');
  const [roundName, setRoundName] = useState(initialEvent?.roundName ?? '');
  const [opponentName, setOpponentName] = useState(initialEvent?.opponentName ?? '');
  const [isHome, setIsHome] = useState(initialEvent?.isHome ?? true);
  const [htHome, setHtHome] = useState(initialEvent?.halfTimeHomeScore != null ? String(initialEvent.halfTimeHomeScore) : '');
  const [htAway, setHtAway] = useState(initialEvent?.halfTimeAwayScore != null ? String(initialEvent.halfTimeAwayScore) : '');
  const [homeScore, setHomeScore] = useState(initialEvent?.homeScore != null ? String(initialEvent.homeScore) : '');
  const [awayScore, setAwayScore] = useState(initialEvent?.awayScore != null ? String(initialEvent.awayScore) : '');
  const [hasExtraTime, setHasExtraTime] = useState(initialEvent?.hasExtraTime ?? false);
  const [etHome, setEtHome] = useState(initialEvent?.extraTimeHomeScore != null ? String(initialEvent.extraTimeHomeScore) : '');
  const [etAway, setEtAway] = useState(initialEvent?.extraTimeAwayScore != null ? String(initialEvent.extraTimeAwayScore) : '');
  const [hasPK, setHasPK] = useState(initialEvent?.hasPK ?? false);
  const [pkHome, setPkHome] = useState(initialEvent?.pkHomeScore != null ? String(initialEvent.pkHomeScore) : '');
  const [pkAway, setPkAway] = useState(initialEvent?.pkAwayScore != null ? String(initialEvent.pkAwayScore) : '');
  const [scorers, setScorers] = useState<SchScorer[]>(initialEvent?.scorers ?? []);
  const [assists, setAssists] = useState<SchScorer[]>(initialEvent?.assists ?? []);
  const [memo, setMemo] = useState(initialEvent?.memo ?? '');

  // Scorer/assist input state
  const [scorerMid, setScorerMid] = useState('');
  const [scorerCnt, setScorerCnt] = useState(1);
  const [assistMid, setAssistMid] = useState('');
  const [assistCnt, setAssistCnt] = useState(1);

  // Camp/expedition
  const [mapQuery, setMapQuery] = useState(initialEvent?.mapQuery ?? '');

  const sortedMembers = useMemo(() => [...members].sort((a, b) => a.number - b.number), [members]);

  const addScorer = () => {
    if (!scorerMid) return;
    setScorers(prev => {
      const ex = prev.find(s => s.memberId === scorerMid);
      if (ex) return prev.map(s => s.memberId === scorerMid ? { ...s, count: s.count + scorerCnt } : s);
      return [...prev, { memberId: scorerMid, count: scorerCnt }];
    });
    setScorerMid(''); setScorerCnt(1);
  };
  const addAssist = () => {
    if (!assistMid) return;
    setAssists(prev => {
      const ex = prev.find(s => s.memberId === assistMid);
      if (ex) return prev.map(s => s.memberId === assistMid ? { ...s, count: s.count + assistCnt } : s);
      return [...prev, { memberId: assistMid, count: assistCnt }];
    });
    setAssistMid(''); setAssistCnt(1);
  };

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
      maxParkingSlots: parkingAvailable ? (maxParkingSlots !== DEFAULT_MAX_SLOTS ? maxParkingSlots : undefined) : 0,
    };
    if (type === 'match') {
      Object.assign(base, {
        matchType, matchFormat,
        roundName: roundName || undefined,
        opponentName: opponentName || undefined,
        isHome,
        homeScore:  homeScore  !== '' ? Number(homeScore)  : undefined,
        awayScore:  awayScore  !== '' ? Number(awayScore)  : undefined,
        halfTimeHomeScore: htHome !== '' ? Number(htHome) : undefined,
        halfTimeAwayScore: htAway !== '' ? Number(htAway) : undefined,
        hasExtraTime,
        extraTimeHomeScore: hasExtraTime && etHome !== '' ? Number(etHome) : undefined,
        extraTimeAwayScore: hasExtraTime && etAway !== '' ? Number(etAway) : undefined,
        hasPK,
        pkHomeScore: hasPK && pkHome !== '' ? Number(pkHome) : undefined,
        pkAwayScore: hasPK && pkAway !== '' ? Number(pkAway) : undefined,
        scorers: scorers.length > 0 ? scorers : undefined,
        assists: assists.length > 0 ? assists : undefined,
        memo: memo || undefined,
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
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">何台？</span>
                  <input type="number" min="1" max="20" value={maxParkingSlots} onChange={e => setMaxParkingSlots(Number(e.target.value))} className="w-20 rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none text-center" />
                  <span className="text-xs text-slate-400">台</span>
                </div>
              )}
            </div>

            {/* Match-specific fields */}
            {type === 'match' && (
              <div className="space-y-3 border-t border-white/10 pt-4">
                <p className="text-xs font-bold text-red-400 uppercase tracking-wider">試合情報</p>

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

                {(matchFormat === 'tournament' || matchFormat === 'league_tournament') && (
                  <div><label className={labelCls}>ラウンド名</label><input type="text" value={roundName} onChange={e => setRoundName(e.target.value)} placeholder="例: グループA / 準決勝" className={inputCls} /></div>
                )}

                <div><label className={labelCls}>🆚 対戦相手</label><input type="text" value={opponentName} onChange={e => setOpponentName(e.target.value)} placeholder="例: ○○FC" className={inputCls} /></div>

                <div className="flex gap-2 items-center">
                  <span className="text-xs text-slate-400 font-semibold">ホーム/アウェー:</span>
                  <button type="button" onClick={() => setIsHome(true)} className={`px-3 py-1 rounded-lg text-xs font-bold ${isHome ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>ホーム</button>
                  <button type="button" onClick={() => setIsHome(false)} className={`px-3 py-1 rounded-lg text-xs font-bold ${!isHome ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400'}`}>アウェー</button>
                </div>

                {/* Score */}
                <div>
                  <label className={labelCls}>スコア</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-10">前半</span>
                      <input type="number" min="0" value={htHome} onChange={e => setHtHome(e.target.value)} placeholder="-" className="w-16 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-1.5 text-sm text-center focus:border-red-400 focus:outline-none" />
                      <span className="text-slate-400 font-bold">−</span>
                      <input type="number" min="0" value={htAway} onChange={e => setHtAway(e.target.value)} placeholder="-" className="w-16 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-1.5 text-sm text-center focus:border-red-400 focus:outline-none" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-10">合計</span>
                      <input type="number" min="0" value={homeScore} onChange={e => setHomeScore(e.target.value)} placeholder="-" className="w-16 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-1.5 text-sm text-center focus:border-red-400 focus:outline-none" />
                      <span className="text-slate-400 font-bold">−</span>
                      <input type="number" min="0" value={awayScore} onChange={e => setAwayScore(e.target.value)} placeholder="-" className="w-16 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-1.5 text-sm text-center focus:border-red-400 focus:outline-none" />
                      <span className="text-xs text-slate-500">(90分時点)</span>
                    </div>
                  </div>
                </div>

                {/* Extra time */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={hasExtraTime} onChange={e => setHasExtraTime(e.target.checked)} className="w-4 h-4 accent-orange-500" />
                  <span className="text-sm text-slate-300">延長戦あり</span>
                </label>
                {hasExtraTime && (
                  <div className="flex items-center gap-2 pl-6">
                    <span className="text-xs text-slate-400 w-10">延長</span>
                    <input type="number" min="0" value={etHome} onChange={e => setEtHome(e.target.value)} placeholder="-" className="w-16 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-1.5 text-sm text-center focus:outline-none" />
                    <span className="text-slate-400 font-bold">−</span>
                    <input type="number" min="0" value={etAway} onChange={e => setEtAway(e.target.value)} placeholder="-" className="w-16 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-1.5 text-sm text-center focus:outline-none" />
                  </div>
                )}

                {/* PK */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={hasPK} onChange={e => setHasPK(e.target.checked)} className="w-4 h-4 accent-yellow-500" />
                  <span className="text-sm text-slate-300">PKあり</span>
                </label>
                {hasPK && (
                  <div className="flex items-center gap-2 pl-6">
                    <span className="text-xs text-slate-400 w-10">PK</span>
                    <input type="number" min="0" value={pkHome} onChange={e => setPkHome(e.target.value)} placeholder="-" className="w-16 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-1.5 text-sm text-center focus:outline-none" />
                    <span className="text-slate-400 font-bold">−</span>
                    <input type="number" min="0" value={pkAway} onChange={e => setPkAway(e.target.value)} placeholder="-" className="w-16 rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-1.5 text-sm text-center focus:outline-none" />
                  </div>
                )}

                {/* Scorers */}
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
                    {scorers.length > 0 && (
                      <div className="space-y-1">
                        {scorers.map(s => {
                          const m = sortedMembers.find(x => x.id === s.memberId);
                          return (
                            <div key={s.memberId} className="flex items-center gap-2 bg-slate-700/40 rounded-lg px-3 py-1.5">
                              <span className="text-xs text-white flex-1">#{m?.number} {m?.name} × {s.count}</span>
                              <button type="button" onClick={() => setScorers(prev => prev.filter(x => x.memberId !== s.memberId))} className="text-slate-400 hover:text-red-400 text-xs">削除</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Assists */}
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
                    {assists.length > 0 && (
                      <div className="space-y-1">
                        {assists.map(s => {
                          const m = sortedMembers.find(x => x.id === s.memberId);
                          return (
                            <div key={s.memberId} className="flex items-center gap-2 bg-slate-700/40 rounded-lg px-3 py-1.5">
                              <span className="text-xs text-white flex-1">#{m?.number} {m?.name} × {s.count}</span>
                              <button type="button" onClick={() => setAssists(prev => prev.filter(x => x.memberId !== s.memberId))} className="text-slate-400 hover:text-red-400 text-xs">削除</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Memo */}
                <div><label className={labelCls}>💬 一言メモ</label><input type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="試合の感想・特記事項" className={inputCls} /></div>
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
  const today = todayStr();
  const isPast = (event.endDate ?? event.date) < today;
  const cfg = tc(event.type);
  const hasScore = event.homeScore != null && event.awayScore != null;
  const isWin = hasScore && event.homeScore! > event.awayScore!;
  const isLoss = hasScore && event.homeScore! < event.awayScore!;
  const getMember = (id: string) => members.find(m => m.id === id);

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
              {event.roundName && (
                <span className="text-[10px] bg-slate-700/60 text-slate-400 px-1.5 py-0.5 rounded-full">{event.roundName}</span>
              )}
              {hasScore && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isWin ? 'bg-green-600/30 text-green-300' : isLoss ? 'bg-red-600/30 text-red-300' : 'bg-slate-600/30 text-slate-300'}`}>
                  {isWin ? '勝' : isLoss ? '負' : '分'}
                </span>
              )}
            </div>
            {/* Title */}
            <p className="text-sm font-semibold text-white mt-1 truncate">
              {event.type === 'match' ? (event.opponentName ? `🆚 ${event.opponentName}` : '相手未定') : (event.label || event.location || '（タイトルなし）')}
            </p>
            {event.type === 'match' && event.label && <p className="text-xs text-slate-400 truncate">{event.label}</p>}
            {hasScore && <p className="text-xl font-extrabold text-white leading-tight">{event.homeScore} <span className="text-slate-400 text-sm font-normal">−</span> {event.awayScore}</p>}
            {!hasScore && isPast && event.type === 'match' && (
              <p className="text-[11px] text-amber-400/80 italic mt-0.5">🙏 誰か戦績を入力して頂けるとありがたいです</p>
            )}
            {!hasScore && event.type === 'match' && event.startTime && <p className="text-xs text-slate-400">⏰ {event.startTime} K.O.</p>}
            {event.type !== 'match' && (event.startTime || event.endTime) && (
              <p className="text-xs text-slate-400">⏰ {event.startTime ?? ''}{event.startTime && event.endTime ? ' 〜 ' : ''}{event.endTime ?? ''}</p>
            )}
            {event.location && <p className="text-xs text-slate-400 truncate">📍 {event.location}</p>}
          </div>
          {/* Actions */}
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button onClick={onEdit} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700">編集</button>
            <button onClick={onDelete} className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-slate-700">削除</button>
            <button onClick={() => setExpanded(p => !p)} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700">{expanded ? '閉じる' : '詳細'}</button>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="bg-slate-800/80 border-t border-white/10 px-4 py-3 space-y-3">
          {/* Score breakdown */}
          {event.type === 'match' && (event.halfTimeHomeScore != null || event.halfTimeAwayScore != null || event.hasExtraTime || event.hasPK) && (
            <div className="space-y-1 text-xs">
              {(event.halfTimeHomeScore != null || event.halfTimeAwayScore != null) && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 w-12">前半</span>
                  <span className="text-white font-semibold">{event.halfTimeHomeScore ?? '-'} − {event.halfTimeAwayScore ?? '-'}</span>
                </div>
              )}
              {hasScore && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 w-12">合計</span>
                  <span className="text-white font-semibold">{event.homeScore} − {event.awayScore}</span>
                </div>
              )}
              {event.hasExtraTime && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 w-12">延長</span>
                  <span className="text-white font-semibold">{event.extraTimeHomeScore ?? '-'} − {event.extraTimeAwayScore ?? '-'}</span>
                </div>
              )}
              {event.hasPK && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 w-12">PK</span>
                  <span className="text-white font-semibold">{event.pkHomeScore ?? '-'} − {event.pkAwayScore ?? '-'}</span>
                </div>
              )}
            </div>
          )}

          {/* Scorers */}
          {event.scorers && event.scorers.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">⚽ 得点者</p>
              <div className="flex flex-wrap gap-1.5">
                {event.scorers.map(s => {
                  const m = getMember(s.memberId);
                  return (
                    <span key={s.memberId} className="text-xs bg-green-600/20 text-green-300 px-2 py-0.5 rounded-full">
                      #{m?.number} {m?.name} {s.count > 1 ? `×${s.count}` : ''}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assists */}
          {event.assists && event.assists.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">🎯 アシスト</p>
              <div className="flex flex-wrap gap-1.5">
                {event.assists.map(s => {
                  const m = getMember(s.memberId);
                  return (
                    <span key={s.memberId} className="text-xs bg-blue-600/20 text-blue-300 px-2 py-0.5 rounded-full">
                      #{m?.number} {m?.name} {s.count > 1 ? `×${s.count}` : ''}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Memo */}
          {event.memo && <p className="text-xs text-slate-300 italic">💬 {event.memo}</p>}

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
  const upcoming = filtered.filter(e => (e.endDate ?? e.date) >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = filtered.filter(e => (e.endDate ?? e.date) < today).sort((a, b) => b.date.localeCompare(a.date));

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
      <div className="flex gap-1.5 flex-wrap">
        {filterBtns.map(({ key, icon, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors ${filter === key ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white'}`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {upcoming.length === 0 && past.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-8">予定がありません</p>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          {upcoming.map(ev => (
            <EventCard key={ev.id} event={ev} members={members} onEdit={() => openEdit(ev)} onDelete={() => handleDelete(ev.id)} />
          ))}
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <details className="mt-2" open>
          <summary className="text-xs text-slate-500 cursor-pointer mb-2 select-none">過去の予定 ({past.length}件)</summary>
          <div className="space-y-2 mt-2">
            {past.map(ev => (
              <EventCard key={ev.id} event={ev} members={members} onEdit={() => openEdit(ev)} onDelete={() => handleDelete(ev.id)} />
            ))}
          </div>
        </details>
      )}

      {showForm && (
        <EventForm
          initialEvent={editing ?? undefined}
          members={members}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

// ---- StatsSection ----
type StatTab = 'overall' | 'byType' | 'byOpponent' | 'byPeriod';

function StatsSection({ events, members }: { events: SchEvent[]; members: SchMember[] }) {
  const [statTab, setStatTab] = useState<StatTab>('overall');

  const matchEvents = useMemo(
    () => events.filter(e => e.type === 'match' && e.homeScore != null && e.awayScore != null),
    [events]
  );

  const calcRecord = (evs: SchEvent[]) => {
    const w = evs.filter(e => e.homeScore! > e.awayScore!).length;
    const d = evs.filter(e => e.homeScore! === e.awayScore!).length;
    const l = evs.filter(e => e.homeScore! < e.awayScore!).length;
    const gf = evs.reduce((sum, e) => sum + (e.homeScore ?? 0), 0);
    const ga = evs.reduce((sum, e) => sum + (e.awayScore ?? 0), 0);
    return { w, d, l, gf, ga, total: evs.length };
  };

  const overall = useMemo(() => calcRecord(matchEvents), [matchEvents]);

  const byType = useMemo(() => MATCH_TYPES.map(mt => ({
    type: mt,
    ...calcRecord(matchEvents.filter(e => (e.matchType ?? 'その他') === mt)),
  })), [matchEvents]);

  const byOpponent = useMemo(() => {
    const opponents = [...new Set(matchEvents.map(e => e.opponentName).filter((x): x is string => !!x))].sort();
    return opponents.map(opp => ({
      opp,
      ...calcRecord(matchEvents.filter(e => e.opponentName === opp)),
    }));
  }, [matchEvents]);

  const byPeriod = useMemo(() => {
    const year = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, i) => {
      const month = String(i + 1).padStart(2, '0');
      const prefix = `${year}/${month}`;
      const evs = matchEvents.filter(e => e.date.startsWith(prefix));
      return { month: `${i + 1}月`, ...calcRecord(evs) };
    }).filter(m => m.total > 0);
  }, [matchEvents]);

  // Top scorers
  const topScorers = useMemo(() => {
    const counts: Record<string, number> = {};
    events.filter(e => e.type === 'match').forEach(e => {
      (e.scorers ?? []).forEach(s => {
        counts[s.memberId] = (counts[s.memberId] ?? 0) + s.count;
      });
    });
    return Object.entries(counts)
      .map(([id, count]) => ({ member: members.find(m => m.id === id), count }))
      .filter(x => x.member)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [events, members]);

  const statTabs: { key: StatTab; label: string }[] = [
    { key: 'overall',    label: '通算' },
    { key: 'byType',     label: '区分別' },
    { key: 'byOpponent', label: '相手別' },
    { key: 'byPeriod',   label: '期間別' },
  ];

  if (matchEvents.length === 0) {
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
    ev.type === 'match' ? (ev.opponentName ? `vs ${ev.opponentName}` : '試合') : (ev.label || ev.location || tc(ev.type).label);

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
                        <span className="text-slate-300 flex-1">{m.name}</span>
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
                        <span className="text-slate-300 flex-1">{m.name}</span>
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
                        <span className="text-slate-400 flex-1">{m.name}</span>
                        <span className="text-amber-500/80 text-[10px]">スキップ{slot.skipComment ? `（${slot.skipComment}）` : ''}</span>
                      </div>
                    );
                  })}
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
  events, members, parkingRecords, parkingRotation, nearbyParking,
  onSkip, onUnskip, onMarkUsed, onMarkPending, onSaveHistory, onUpdateMaxSlots,
}: {
  events: SchEvent[];
  members: SchMember[];
  parkingRecords: SchParkingRecord[];
  parkingRotation: number;
  nearbyParking: SchNearbyParking[];
  onSkip: (eventId: string, memberId: string, comment: string) => void;
  onUnskip: (eventId: string, memberId: string) => void;
  onMarkUsed: (eventId: string, memberId: string) => void;
  onMarkPending: (eventId: string, memberId: string) => void;
  onSaveHistory: (eventId: string, slots: SchParkingSlot[]) => void;
  onUpdateMaxSlots: (eventId: string, maxSlots: number) => void;
}) {
  const today = todayStr();
  const sortedMembers = useMemo(() => [...members].sort((a, b) => a.number - b.number), [members]);

  const upcomingEvents = useMemo(
    () => events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
    [events, today]
  );
  const nextEvent = upcomingEvents[0];

  const toEventItem = (e: SchEvent): EventItem => ({
    id: e.id,
    date: e.date,
    type: e.type,
    label: e.type === 'match' ? (e.opponentName ? `🆚 ${e.opponentName}` : '相手未定') : (e.label || e.location || tc(e.type).label),
    maxSlots: e.maxParkingSlots ?? DEFAULT_MAX_SLOTS,
  });

  const eventItems: EventItem[] = useMemo(
    () => upcomingEvents.slice(0, 6).map(toEventItem),
    [upcomingEvents]
  );

  const pastEvents = useMemo(
    () => [...events]
      .filter(e => e.date < today)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10),
    [events, today]
  );

  const parkingPlan = useMemo(
    () => buildParkingPlan(sortedMembers, eventItems, parkingRotation, parkingRecords),
    [sortedMembers, eventItems, parkingRotation, parkingRecords]
  );

  return (
    <div className="space-y-5">
      {/* Next event */}
      <div>
        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">次の予定</h2>
        {nextEvent ? (
          <div className={`rounded-2xl p-4 border ${tc(nextEvent.type).border} ${tc(nextEvent.type).bg}`}>
            <div className="flex items-start gap-3">
              <div className={`text-center px-3 py-2 rounded-xl min-w-[54px] bg-black/20 text-white`}>
                <p className="text-[11px]">{nextEvent.date.slice(5).replace('/', '/')}</p>
                <p className="text-xl font-extrabold leading-tight">{dayLabel(nextEvent.date)}</p>
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tc(nextEvent.type).badge}`}>
                  {tc(nextEvent.type).icon} {tc(nextEvent.type).label}
                </span>
                <p className="text-base font-bold text-white mt-1.5 truncate">
                  {nextEvent.type === 'match' ? (nextEvent.opponentName ? `🆚 ${nextEvent.opponentName}` : '相手未定') : (nextEvent.label || nextEvent.location || '詳細未定')}
                </p>
                {nextEvent.startTime && <p className="text-sm text-slate-300 mt-0.5">⏰ {nextEvent.startTime}{nextEvent.endTime ? ` 〜 ${nextEvent.endTime}` : ''}</p>}
                {nextEvent.location && <p className="text-xs text-slate-400 mt-0.5">📍 {nextEvent.location}</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-5 border bg-slate-800/40 border-white/5 text-center text-slate-400 text-sm">予定がありません</div>
        )}
      </div>

      {/* Parking forecast */}
      <div>
        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">🅿️ 駐車場予測</h2>
        {sortedMembers.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-4">メンバーを登録してください</p>
        ) : parkingPlan.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-4">予定がありません</p>
        ) : (
          <div className="space-y-3">
            {parkingPlan.map(plan => (
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
    </div>
  );
}

// ---- AnnounceSection ----
function AnnounceSection({ announcements, onSave }: { announcements: SchAnnouncement[]; onSave: (a: SchAnnouncement[]) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SchAnnouncement | null>(null);
  const [date, setDate] = useState(todayStr());
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [important, setImportant] = useState(false);

  const resetForm = () => { setDate(todayStr()); setTitle(''); setContent(''); setImportant(false); setEditing(null); setShowForm(false); };
  const openEdit = (a: SchAnnouncement) => { setEditing(a); setDate(a.date); setTitle(a.title); setContent(a.content); setImportant(a.important ?? false); setShowForm(true); };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    const entry: SchAnnouncement = { id: editing?.id ?? generateId(), date, title, content, important };
    const updated = editing ? announcements.map(a => a.id === editing.id ? entry : a) : [...announcements, entry];
    onSave(updated.sort((a, b) => b.date.localeCompare(a.date)));
    resetForm();
  };
  const handleDelete = (id: string) => { if (window.confirm('削除しますか？')) onSave(announcements.filter(a => a.id !== id)); };
  const sorted = [...announcements].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-3">
      <button onClick={() => setShowForm(true)} className="w-full bg-gradient-to-r from-purple-600 to-violet-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
        <span className="text-lg">＋</span> お知らせを投稿
      </button>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={resetForm}>
          <div className="bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-6 space-y-3">
              <div className="flex items-center justify-between"><h3 className="text-base font-bold text-white">{editing ? 'お知らせを編集' : 'お知らせを投稿'}</h3><button onClick={resetForm} className="text-slate-400 text-2xl">&times;</button></div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">📅 日付</label><input type="date" value={toInputDate(date)} onChange={e => setDate(fromInputDate(e.target.value))} required className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-purple-400 focus:outline-none" /></div>
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">📌 タイトル</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="例: 次回練習のお知らせ" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-purple-400 focus:outline-none placeholder-slate-500" /></div>
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">📝 内容</label><textarea value={content} onChange={e => setContent(e.target.value)} required rows={4} placeholder="お知らせの内容を入力" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-purple-400 focus:outline-none placeholder-slate-500 resize-none" /></div>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={important} onChange={e => setImportant(e.target.checked)} className="w-4 h-4 accent-red-500" /><span className="text-sm text-slate-300">🔴 重要なお知らせとしてマーク</span></label>
                <button type="submit" className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl text-sm">投稿</button>
              </form>
            </div>
          </div>
        </div>
      )}
      {sorted.length === 0 && <p className="text-center text-slate-400 text-sm py-8">お知らせがありません</p>}
      <div className="space-y-2">
        {sorted.map(a => (
          <div key={a.id} className={`rounded-xl p-4 border ${a.important ? 'bg-red-900/20 border-red-500/40' : 'bg-slate-800/60 border-white/10'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">{a.important && <span className="text-xs font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">重要</span>}<span className="text-xs text-slate-400">{a.date}</span></div>
                <p className="text-sm font-bold text-white">{a.title}</p>
                <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap">{a.content}</p>
              </div>
              <div className="flex flex-col gap-1"><button onClick={() => openEdit(a)} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700">編集</button><button onClick={() => handleDelete(a.id)} className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-slate-700">削除</button></div>
            </div>
          </div>
        ))}
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
                  <span className="text-white text-sm font-medium">{m.name}</span>
                  {m.nameKana && <span className="text-slate-500 text-xs ml-2">（{m.nameKana}）</span>}
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
              <p className="text-sm font-bold text-white mt-0.5">#{nextMember.number} {nextMember.name} から</p>
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-extrabold text-blue-300 bg-blue-900/30 rounded-xl px-3 py-1">#{m.number}</span>
                    <div>
                      <p className="text-base font-bold text-white">{m.name}</p>
                      {m.nameKana && <p className="text-xs text-slate-400">{m.nameKana}</p>}
                    </div>
                  </div>
                  <button onClick={() => setViewingMember(null)} className="text-slate-400 text-2xl">&times;</button>
                </div>
                <div className="space-y-2">
                  {m.birthDate && (
                    <div className="flex items-center gap-3 bg-slate-700/40 rounded-xl px-4 py-2.5">
                      <span className="text-lg">🎂</span>
                      <div>
                        <p className="text-[10px] text-slate-400">生年月日</p>
                        <p className="text-sm text-white">{m.birthDate.replace(/-/g, '/')}
                          {age !== null && <span className="text-slate-400 text-xs ml-2">（{age}歳）</span>}
                        </p>
                      </div>
                    </div>
                  )}
                  {m.parents && m.parents.length > 0 && m.parents.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 bg-slate-700/40 rounded-xl px-4 py-2.5">
                      <span className="text-lg">{p.role === '父' ? '👨' : p.role === '母' ? '👩' : '👤'}</span>
                      <div>
                        <p className="text-[10px] text-slate-400">保護者（{p.role}）</p>
                        <p className="text-sm text-white">{p.name}</p>
                      </div>
                    </div>
                  ))}
                  {!m.birthDate && (!m.parents || m.parents.length === 0) && (
                    <p className="text-sm text-slate-500 text-center py-2">詳細情報なし</p>
                  )}
                </div>
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
                      <div key={i} className="flex gap-2 items-center">
                        <select value={p.role} onChange={e => updateParent(i, 'role', e.target.value)} className="rounded-lg border border-slate-600 bg-slate-900 text-white px-2 py-2 text-xs focus:border-blue-400 focus:outline-none w-20">
                          <option>父</option><option>母</option><option>その他</option>
                        </select>
                        <input type="text" value={p.name} onChange={e => updateParent(i, 'name', e.target.value)} placeholder="氏名" className="flex-1 rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none placeholder-slate-500" />
                        <button type="button" onClick={() => removeParent(i)} className="text-slate-400 hover:text-red-400 text-lg px-1">×</button>
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

export default function SchPage() {
  const [tab, setTab] = useState<Tab>('home');
  const [events, setEvents] = useState<SchEvent[]>([]);
  const [announcements, setAnnouncements] = useState<SchAnnouncement[]>([]);
  const [members, setMembers] = useState<SchMember[]>([]);
  const [parkingRecords, setParkingRecords] = useState<SchParkingRecord[]>([]);
  const [parkingRotation, setParkingRotation] = useState(5);
  const [nearbyParking, setNearbyParking] = useState<SchNearbyParking[]>([]);
  const [teamLogo, setTeamLogo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sch').then(r => r.json()).then(d => {
      setEvents(d.events ?? []);
      setAnnouncements(d.announcements ?? []);
      setMembers(d.members ?? []);
      setParkingRecords(d.parkingRecords ?? []);
      setParkingRotation(d.parkingRotation ?? 5);
      setNearbyParking(d.nearbyParking ?? []);
      setTeamLogo(d.teamLogo ?? null);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  const post = useCallback((body: object) => {
    fetch('/api/sch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(console.error);
  }, []);

  const saveEvents       = useCallback((e: SchEvent[])       => { setEvents(e);       post({ events: e }); }, [post]);
  const saveAnnounce     = useCallback((a: SchAnnouncement[]) => { setAnnouncements(a); post({ announcements: a }); }, [post]);
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
    { key: 'member'  as Tab, label: 'メンバー', icon: '👥' },
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

      {tab === 'home' && (
        <HomeSection
          events={events} members={members}
          parkingRecords={parkingRecords} parkingRotation={parkingRotation}
          nearbyParking={nearbyParking}
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
        <AnnounceSection announcements={announcements} onSave={saveAnnounce} />
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
