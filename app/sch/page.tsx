'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { SchSchedule, SchMatch, SchAnnouncement, SchMember, SchParkingRecord, SchParkingSlot, SchNearbyParking } from '@/lib/types';

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

const MAX_SLOTS = 4;

// ---- Parking Logic ----
type EventItem = { id: string; date: string; type: 'schedule' | 'match'; label: string };

function computeEventParking(
  sortedMembers: SchMember[],
  rotationIndex: number,
  skippedMemberIds: string[]
): { slots: SchParkingSlot[]; consumedCount: number } {
  const n = sortedMembers.length;
  if (n === 0) return { slots: [], consumedCount: 0 };
  const skipped = new Set(skippedMemberIds);
  const slots: SchParkingSlot[] = [];
  let offset = 0;
  let filledSlots = 0;
  while (filledSlots < MAX_SLOTS && offset < n) {
    const member = sortedMembers[(rotationIndex + offset) % n];
    offset++;
    if (skipped.has(member.id)) {
      slots.push({ memberId: member.id, status: 'skipped' });
    } else {
      slots.push({ memberId: member.id, status: 'pending', isFillIn: offset > MAX_SLOTS });
      filledSlots++;
    }
  }
  return { slots, consumedCount: offset };
}

type EventPlan = EventItem & { slots: SchParkingSlot[]; rotationStartIndex: number; consumedCount: number };

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
    const { slots, consumedCount } = computeEventParking(sortedMembers, ri, skippedIds);
    // Merge persisted statuses
    const mergedSlots = slots.map(slot => {
      const persisted = record?.slots.find(s => s.memberId === slot.memberId);
      return persisted ? { ...slot, ...persisted } : slot;
    });
    const startRi = ri;
    ri = (ri + consumedCount) % Math.max(sortedMembers.length, 1);
    return { ...event, slots: mergedSlots, rotationStartIndex: startRi, consumedCount };
  });
}

// ---- Parking Event Card ----
function ParkingEventCard({
  plan, members, onSkip, onUnskip, onMarkUsed,
}: {
  plan: EventPlan;
  members: SchMember[];
  onSkip: (eventId: string, memberId: string, comment: string) => void;
  onUnskip: (eventId: string, memberId: string) => void;
  onMarkUsed: (eventId: string, memberId: string) => void;
}) {
  const [skipTarget, setSkipTarget] = useState<string | null>(null);
  const [skipComment, setSkipComment] = useState('');
  const getMember = (id: string) => members.find(m => m.id === id);
  const today = todayStr();
  const isPast = plan.date < today;
  const activeSlots = plan.slots.filter(s => s.status !== 'skipped');
  const skippedSlots = plan.slots.filter(s => s.status === 'skipped');

  return (
    <div className={`rounded-xl overflow-hidden border ${isPast ? 'opacity-60 border-white/5' : plan.type === 'schedule' ? 'border-green-500/20' : 'border-red-500/20'}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 px-4 py-2 ${plan.type === 'schedule' ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${plan.type === 'schedule' ? 'bg-green-600/40 text-green-300' : 'bg-red-600/40 text-red-300'}`}>
          {plan.type === 'schedule' ? '⚽ 練習' : '🏆 試合'}
        </span>
        <span className="text-sm font-semibold text-white">{plan.date.slice(5).replace('/', '/')}</span>
        <span className="text-xs text-slate-400">({dayLabel(plan.date)})</span>
        <span className="text-xs text-slate-400 truncate flex-1">{plan.label}</span>
        <span className="text-[10px] text-slate-500">🅿️ {MAX_SLOTS}台</span>
      </div>

      {/* Active slots */}
      <div className="bg-slate-800/60">
        {activeSlots.map((slot, i) => {
          const member = getMember(slot.memberId);
          if (!member) return null;
          return (
            <div key={slot.memberId} className={`flex items-center gap-3 px-4 py-2.5 ${i < activeSlots.length - 1 ? 'border-b border-white/5' : ''}`}>
              <span className="text-slate-500 text-xs w-4 text-right">{i + 1}</span>
              <span className="w-9 text-center text-xs font-bold text-blue-300 bg-blue-900/30 rounded py-0.5">#{member.number}</span>
              <span className="text-white text-sm flex-1">{member.name}</span>
              {slot.isFillIn && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full">補欠</span>
              )}
              {slot.status === 'used' && (
                <span className="text-[10px] bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded-full">✓ 使用</span>
              )}
              {slot.status === 'pending' && !isPast && (
                <div className="flex gap-1">
                  <button
                    onClick={() => setSkipTarget(slot.memberId)}
                    className="text-[10px] text-slate-500 hover:text-amber-400 px-2 py-0.5 rounded border border-slate-700 hover:border-amber-500/50 transition-colors"
                  >
                    スキップ
                  </button>
                  <button
                    onClick={() => onMarkUsed(plan.id, slot.memberId)}
                    className="text-[10px] text-slate-500 hover:text-green-400 px-2 py-0.5 rounded border border-slate-700 hover:border-green-500/50 transition-colors"
                  >
                    使用
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Skipped */}
      {skippedSlots.length > 0 && (
        <div className="bg-slate-800/30 border-t border-white/5 px-4 py-2 space-y-1">
          {skippedSlots.map(slot => {
            const member = getMember(slot.memberId);
            return (
              <div key={slot.memberId} className="flex items-center gap-2 text-xs">
                <span className="text-slate-600 line-through">#{member?.number} {member?.name}</span>
                {slot.skipComment && <span className="text-slate-600">「{slot.skipComment}」</span>}
                {!isPast && (
                  <button onClick={() => onUnskip(plan.id, slot.memberId)} className="ml-auto text-slate-600 hover:text-slate-400 text-[10px]">取消</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Skip input */}
      {skipTarget && (
        <div className="border-t border-amber-500/30 bg-amber-900/10 px-4 py-3">
          <p className="text-xs text-amber-300 mb-2">
            スキップコメント（空欄可）
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={skipComment}
              onChange={e => setSkipComment(e.target.value)}
              placeholder="自分の番はいらない"
              className="flex-1 rounded-lg border border-slate-600 bg-slate-900 text-white px-3 py-1.5 text-xs focus:border-amber-400 focus:outline-none placeholder-slate-600"
              autoFocus
            />
            <button
              onClick={() => {
                onSkip(plan.id, skipTarget, skipComment || '自分の番はいらない');
                setSkipTarget(null); setSkipComment('');
              }}
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-3 py-1.5 rounded-lg"
            >
              確定
            </button>
            <button
              onClick={() => { setSkipTarget(null); setSkipComment(''); }}
              className="text-slate-400 text-xs px-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Home Section ----
function HomeSection({
  schedules, matches, members, parkingRecords, parkingRotation, nearbyParking,
  onSkip, onUnskip, onMarkUsed,
}: {
  schedules: SchSchedule[];
  matches: SchMatch[];
  members: SchMember[];
  parkingRecords: SchParkingRecord[];
  parkingRotation: number;
  nearbyParking: SchNearbyParking[];
  onSkip: (eventId: string, memberId: string, comment: string) => void;
  onUnskip: (eventId: string, memberId: string) => void;
  onMarkUsed: (eventId: string, memberId: string) => void;
}) {
  const today = todayStr();
  const sortedMembers = useMemo(() => [...members].sort((a, b) => a.number - b.number), [members]);

  // Build unified event list (upcoming first, then a few past)
  const allEvents: EventItem[] = useMemo(() => [
    ...schedules.map(s => ({ id: s.id, date: s.date, type: 'schedule' as const, label: s.location })),
    ...matches.map(m => ({ id: m.id, date: m.date, type: 'match' as const, label: m.opponent ?? '相手未定' })),
  ].sort((a, b) => a.date.localeCompare(b.date)), [schedules, matches]);

  const upcomingEvents = allEvents.filter(e => e.date >= today);
  const nextEvent = upcomingEvents[0];

  const parkingPlan = useMemo(
    () => buildParkingPlan(sortedMembers, upcomingEvents.slice(0, 6), parkingRotation, parkingRecords),
    [sortedMembers, upcomingEvents, parkingRotation, parkingRecords]
  );

  return (
    <div className="space-y-5">
      {/* Next event */}
      <div>
        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">次の予定</h2>
        {nextEvent ? (
          <div className={`rounded-2xl p-4 border ${nextEvent.type === 'schedule' ? 'bg-green-900/20 border-green-500/40' : 'bg-red-900/20 border-red-500/40'}`}>
            <div className="flex items-start gap-3">
              <div className={`text-center px-3 py-2 rounded-xl min-w-[54px] ${nextEvent.type === 'schedule' ? 'bg-green-600/30 text-green-200' : 'bg-red-600/30 text-red-200'}`}>
                <p className="text-[11px]">{nextEvent.date.slice(5).replace('/', '/')}</p>
                <p className="text-xl font-extrabold leading-tight">{dayLabel(nextEvent.date)}</p>
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${nextEvent.type === 'schedule' ? 'bg-green-600/40 text-green-300' : 'bg-red-600/40 text-red-300'}`}>
                  {nextEvent.type === 'schedule' ? '⚽ 練習' : '🏆 試合'}
                </span>
                <p className="text-base font-bold text-white mt-1.5 truncate">{nextEvent.label}</p>
                {(() => {
                  const s = schedules.find(x => x.id === nextEvent.id);
                  const m = matches.find(x => x.id === nextEvent.id);
                  if (s && (s.startTime || s.endTime)) return (
                    <p className="text-sm text-slate-300 mt-0.5">⏰ {s.startTime ?? ''}{s.startTime && s.endTime ? ' 〜 ' : ''}{s.endTime ?? ''}</p>
                  );
                  if (m?.startTime) return <p className="text-xs text-slate-400 mt-1">⏰ {m.startTime} キックオフ</p>;
                  return null;
                })()}
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
                  <a
                    href={p.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-400 hover:text-blue-300"
                  >
                    🗺️ Google マップで開く
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Schedule Section ----
function ScheduleSection({ schedules, onSave }: { schedules: SchSchedule[]; onSave: (s: SchSchedule[]) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SchSchedule | null>(null);
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');

  const resetForm = () => { setDate(todayStr()); setStartTime(''); setEndTime(''); setLocation(''); setNote(''); setEditing(null); setShowForm(false); };
  const openEdit = (s: SchSchedule) => {
    setEditing(s); setDate(s.date); setStartTime(s.startTime ?? ''); setEndTime(s.endTime ?? '');
    setLocation(s.location); setNote(s.note ?? ''); setShowForm(true);
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) return;
    const entry: SchSchedule = { id: editing?.id ?? generateId(), date, startTime: startTime || undefined, endTime: endTime || undefined, location, note: note || undefined };
    const updated = editing ? schedules.map(s => s.id === editing.id ? entry : s) : [...schedules, entry];
    onSave(updated.sort((a, b) => a.date.localeCompare(b.date)));
    resetForm();
  };
  const handleDelete = (id: string) => {
    if (window.confirm('削除しますか？')) onSave(schedules.filter(s => s.id !== id));
  };
  const sorted = [...schedules].sort((a, b) => a.date.localeCompare(b.date));
  const today = todayStr();
  const upcoming = sorted.filter(s => s.date >= today);
  const past = sorted.filter(s => s.date < today);

  return (
    <div className="space-y-3">
      <button onClick={() => setShowForm(true)} className="w-full bg-gradient-to-r from-green-600 to-emerald-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
        <span className="text-lg">＋</span> 練習予定を追加
      </button>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={resetForm}>
          <div className="bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-6 space-y-3">
              <div className="flex items-center justify-between"><h3 className="text-base font-bold text-white">{editing ? '練習予定を編集' : '練習予定を追加'}</h3><button onClick={resetForm} className="text-slate-400 text-2xl">&times;</button></div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">📅 日付</label><input type="date" value={date.split('/').join('-')} onChange={e => setDate(e.target.value.split('-').join('/'))} required className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-green-400 focus:outline-none" /></div>
                <div className="flex gap-2">
                  <div className="flex-1"><label className="block text-xs font-semibold text-slate-400 mb-1">⏰ 開始</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-green-400 focus:outline-none" /></div>
                  <div className="flex-1"><label className="block text-xs font-semibold text-slate-400 mb-1">⏰ 終了</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-green-400 focus:outline-none" /></div>
                </div>
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">📍 場所</label><input type="text" value={location} onChange={e => setLocation(e.target.value)} required placeholder="例: ○○グラウンド" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-green-400 focus:outline-none placeholder-slate-500" /></div>
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">📝 メモ</label><input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="持ち物・注意事項など" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-green-400 focus:outline-none placeholder-slate-500" /></div>
                <button type="submit" className="w-full bg-green-600 text-white font-bold py-3 rounded-xl text-sm">保存</button>
              </form>
            </div>
          </div>
        </div>
      )}
      {upcoming.length === 0 && past.length === 0 && <p className="text-center text-slate-400 text-sm py-8">練習予定がありません</p>}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          {upcoming.map(s => (
            <div key={s.id} className="rounded-xl p-3 border bg-slate-800/80 border-green-500/30">
              <div className="flex items-start gap-2">
                <div className="px-2 py-1 rounded-lg text-center min-w-[48px] bg-green-600/20 text-green-300">
                  <p className="text-[10px]">{s.date.slice(5).replace('/', '/')}</p>
                  <p className="text-xs">{dayLabel(s.date)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">📍 {s.location}</p>
                  {(s.startTime || s.endTime) && <p className="text-xs text-slate-400 mt-0.5">⏰ {s.startTime ?? ''}{s.startTime && s.endTime ? ' 〜 ' : ''}{s.endTime ?? ''}</p>}
                  {s.note && <p className="text-xs text-slate-400 mt-0.5 truncate">📝 {s.note}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(s)} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700">編集</button>
                  <button onClick={() => handleDelete(s.id)} className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-slate-700">削除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {past.length > 0 && (
        <details className="mt-2"><summary className="text-xs text-slate-500 cursor-pointer mb-2">過去の予定 ({past.length}件)</summary>
          <div className="space-y-2 opacity-60">
            {[...past].reverse().map(s => (
              <div key={s.id} className="rounded-xl p-3 border bg-slate-800/40 border-white/5">
                <div className="flex items-start gap-2">
                  <div className="px-2 py-1 rounded-lg text-center min-w-[48px] bg-slate-700 text-slate-400"><p className="text-[10px]">{s.date.slice(5).replace('/', '/')}</p><p className="text-xs">{dayLabel(s.date)}</p></div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white truncate">📍 {s.location}</p></div>
                  <div className="flex gap-1"><button onClick={() => openEdit(s)} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700">編集</button><button onClick={() => handleDelete(s.id)} className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-slate-700">削除</button></div>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ---- Match Section ----
function MatchSection({ matches, onSave }: { matches: SchMatch[]; onSave: (m: SchMatch[]) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SchMatch | null>(null);
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState('');
  const [opponent, setOpponent] = useState('');
  const [location, setLocation] = useState('');
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [isHome, setIsHome] = useState(true);
  const [note, setNote] = useState('');

  const resetForm = () => { setDate(todayStr()); setStartTime(''); setOpponent(''); setLocation(''); setHomeScore(''); setAwayScore(''); setIsHome(true); setNote(''); setEditing(null); setShowForm(false); };
  const openEdit = (m: SchMatch) => {
    setEditing(m); setDate(m.date); setStartTime(m.startTime ?? ''); setOpponent(m.opponent ?? '');
    setLocation(m.location ?? ''); setHomeScore(m.homeScore != null ? String(m.homeScore) : '');
    setAwayScore(m.awayScore != null ? String(m.awayScore) : ''); setIsHome(m.isHome ?? true); setNote(m.note ?? ''); setShowForm(true);
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: SchMatch = { id: editing?.id ?? generateId(), date, startTime: startTime || undefined, opponent: opponent || undefined, location: location || undefined, homeScore: homeScore !== '' ? Number(homeScore) : undefined, awayScore: awayScore !== '' ? Number(awayScore) : undefined, isHome, note: note || undefined };
    const updated = editing ? matches.map(m => m.id === editing.id ? entry : m) : [...matches, entry];
    onSave(updated.sort((a, b) => a.date.localeCompare(b.date)));
    resetForm();
  };
  const handleDelete = (id: string) => { if (window.confirm('削除しますか？')) onSave(matches.filter(m => m.id !== id)); };
  const sorted = [...matches].sort((a, b) => b.date.localeCompare(a.date));
  const today = todayStr();

  return (
    <div className="space-y-3">
      <button onClick={() => setShowForm(true)} className="w-full bg-gradient-to-r from-red-600 to-rose-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
        <span className="text-lg">＋</span> 試合を追加
      </button>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={resetForm}>
          <div className="bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-6 space-y-3">
              <div className="flex items-center justify-between"><h3 className="text-base font-bold text-white">{editing ? '試合を編集' : '試合を追加'}</h3><button onClick={resetForm} className="text-slate-400 text-2xl">&times;</button></div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">📅 日付</label><input type="date" value={date.split('/').join('-')} onChange={e => setDate(e.target.value.split('-').join('/'))} required className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-red-400 focus:outline-none" /></div>
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">⏰ キックオフ</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-red-400 focus:outline-none" /></div>
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">🆚 対戦相手</label><input type="text" value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="例: ○○FC" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-red-400 focus:outline-none placeholder-slate-500" /></div>
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">📍 会場</label><input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="例: ○○グラウンド" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-red-400 focus:outline-none placeholder-slate-500" /></div>
                <div className="flex gap-2 items-center">
                  <label className="text-xs font-semibold text-slate-400">ホーム/アウェー:</label>
                  <button type="button" onClick={() => setIsHome(true)} className={`px-3 py-1 rounded-lg text-xs font-bold ${isHome ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>ホーム</button>
                  <button type="button" onClick={() => setIsHome(false)} className={`px-3 py-1 rounded-lg text-xs font-bold ${!isHome ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400'}`}>アウェー</button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1"><label className="block text-xs font-semibold text-slate-400 mb-1">SCH 得点</label><input type="number" min="0" value={homeScore} onChange={e => setHomeScore(e.target.value)} placeholder="-" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm text-center focus:border-red-400 focus:outline-none" /></div>
                  <div className="self-end pb-2.5 text-slate-400 font-bold">−</div>
                  <div className="flex-1"><label className="block text-xs font-semibold text-slate-400 mb-1">相手 得点</label><input type="number" min="0" value={awayScore} onChange={e => setAwayScore(e.target.value)} placeholder="-" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm text-center focus:border-red-400 focus:outline-none" /></div>
                </div>
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">📝 メモ</label><input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="大会名・備考など" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-red-400 focus:outline-none placeholder-slate-500" /></div>
                <button type="submit" className="w-full bg-red-600 text-white font-bold py-3 rounded-xl text-sm">保存</button>
              </form>
            </div>
          </div>
        </div>
      )}
      {sorted.length === 0 && <p className="text-center text-slate-400 text-sm py-8">試合記録がありません</p>}
      <div className="space-y-2">
        {sorted.map(m => {
          const isUpcoming = m.date >= today;
          const hasScore = m.homeScore != null && m.awayScore != null;
          const won = hasScore && m.homeScore! > m.awayScore!;
          const lost = hasScore && m.homeScore! < m.awayScore!;
          return (
            <div key={m.id} className={`rounded-xl p-3 border ${isUpcoming ? 'bg-slate-800/80 border-red-500/30' : 'bg-slate-800/40 border-white/5'}`}>
              <div className="flex items-start gap-2">
                <div className={`text-center px-2 py-1 rounded-lg min-w-[48px] ${isUpcoming ? 'bg-red-600/20 text-red-300' : 'bg-slate-700 text-slate-400'}`}>
                  <p className="text-[10px]">{m.date.slice(5).replace('/', '/')}</p>
                  <p className="text-xs">{dayLabel(m.date)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">🆚 {m.opponent ?? '相手未定'}</p>
                    {hasScore && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${won ? 'bg-green-600/30 text-green-300' : lost ? 'bg-red-600/30 text-red-300' : 'bg-slate-600/30 text-slate-300'}`}>{won ? '勝' : lost ? '負' : '分'}</span>}
                  </div>
                  {hasScore && <p className="text-lg font-extrabold text-white mt-0.5">{m.homeScore} <span className="text-slate-400 text-sm font-normal">−</span> {m.awayScore}</p>}
                  {!hasScore && isUpcoming && m.startTime && <p className="text-xs text-slate-400">⏰ {m.startTime} キックオフ</p>}
                  {m.location && <p className="text-xs text-slate-400 truncate">📍 {m.location}</p>}
                  {m.note && <p className="text-xs text-slate-400 truncate">📝 {m.note}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(m)} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700">編集</button>
                  <button onClick={() => handleDelete(m.id)} className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-slate-700">削除</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Announce Section ----
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
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">📅 日付</label><input type="date" value={date.split('/').join('-')} onChange={e => setDate(e.target.value.split('-').join('/'))} required className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-purple-400 focus:outline-none" /></div>
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

// ---- Member Section (includes Nearby Parking + Rotation reset) ----
function MemberSection({
  members, onSaveMember,
  nearbyParking, onSaveNearbyParking,
  parkingRotation, onResetRotation,
}: {
  members: SchMember[];
  onSaveMember: (m: SchMember[]) => void;
  nearbyParking: SchNearbyParking[];
  onSaveNearbyParking: (p: SchNearbyParking[]) => void;
  parkingRotation: number;
  onResetRotation: (index: number) => void;
}) {
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editingMember, setEditingMember] = useState<SchMember | null>(null);
  const [mNumber, setMNumber] = useState('');
  const [mName, setMName] = useState('');

  const [showParkingForm, setShowParkingForm] = useState(false);
  const [editingParking, setEditingParking] = useState<SchNearbyParking | null>(null);
  const [pName, setPName] = useState('');
  const [pAddress, setPAddress] = useState('');
  const [pMapsUrl, setPMapsUrl] = useState('');
  const [pNote, setPNote] = useState('');

  const resetMemberForm = () => { setMNumber(''); setMName(''); setEditingMember(null); setShowMemberForm(false); };
  const openEditMember = (m: SchMember) => { setEditingMember(m); setMNumber(String(m.number)); setMName(m.name); setShowMemberForm(true); };
  const handleMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mName || !mNumber) return;
    const entry: SchMember = { id: editingMember?.id ?? generateId(), number: Number(mNumber), name: mName };
    const updated = editingMember ? members.map(m => m.id === editingMember.id ? entry : m) : [...members, entry];
    onSaveMember(updated.sort((a, b) => a.number - b.number));
    resetMemberForm();
  };
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

  const sorted = [...members].sort((a, b) => a.number - b.number);
  const nextMember = sorted[parkingRotation % sorted.length];

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
                <span className="text-white text-sm font-medium flex-1">{m.name}</span>
                <div className="flex gap-1">
                  <button onClick={() => openEditMember(m)} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700">編集</button>
                  <button onClick={() => deleteMember(m.id)} className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-slate-700">削除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Parking rotation control */}
      <div>
        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">🅿️ ローテーション管理</h2>
        <div className="bg-slate-800/60 border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">次の割当開始</p>
              {nextMember ? (
                <p className="text-sm font-bold text-white mt-0.5">#{nextMember.number} {nextMember.name} から</p>
              ) : (
                <p className="text-sm text-slate-500 mt-0.5">メンバーなし</p>
              )}
              <p className="text-[10px] text-slate-600 mt-0.5">インデックス: {parkingRotation % Math.max(sorted.length, 1)}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1.5">開始メンバーを変更</p>
            <div className="flex flex-wrap gap-1.5">
              {sorted.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => onResetRotation(i)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${parkingRotation % sorted.length === i ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white'}`}
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

      {/* Member form modal */}
      {showMemberForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={resetMemberForm}>
          <div className="bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-6 space-y-3">
              <div className="flex items-center justify-between"><h3 className="text-base font-bold text-white">{editingMember ? 'メンバーを編集' : 'メンバーを追加'}</h3><button onClick={resetMemberForm} className="text-slate-400 text-2xl">&times;</button></div>
              <form onSubmit={handleMemberSubmit} className="space-y-3">
                <div><label className="block text-xs font-semibold text-slate-400 mb-1"># 背番号</label><input type="number" min="1" max="99" value={mNumber} onChange={e => setMNumber(e.target.value)} required className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none" /></div>
                <div><label className="block text-xs font-semibold text-slate-400 mb-1">👤 名前</label><input type="text" value={mName} onChange={e => setMName(e.target.value)} required placeholder="例: たくと" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none placeholder-slate-500" /></div>
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
type Tab = 'home' | 'schedule' | 'match' | 'announce' | 'member';

export default function SchPage() {
  const [tab, setTab] = useState<Tab>('home');
  const [schedules, setSchedules] = useState<SchSchedule[]>([]);
  const [matches, setMatches] = useState<SchMatch[]>([]);
  const [announcements, setAnnouncements] = useState<SchAnnouncement[]>([]);
  const [members, setMembers] = useState<SchMember[]>([]);
  const [parkingRecords, setParkingRecords] = useState<SchParkingRecord[]>([]);
  const [parkingRotation, setParkingRotation] = useState(5);
  const [nearbyParking, setNearbyParking] = useState<SchNearbyParking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sch').then(r => r.json()).then(d => {
      setSchedules(d.schedules ?? []);
      setMatches(d.matches ?? []);
      setAnnouncements(d.announcements ?? []);
      setMembers(d.members ?? []);
      setParkingRecords(d.parkingRecords ?? []);
      setParkingRotation(d.parkingRotation ?? 5);
      setNearbyParking(d.nearbyParking ?? []);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  const post = useCallback((body: object) => {
    fetch('/api/sch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(console.error);
  }, []);

  const saveSchedules   = useCallback((s: SchSchedule[])    => { setSchedules(s);   post({ schedules: s }); }, [post]);
  const saveMatches     = useCallback((m: SchMatch[])        => { setMatches(m);     post({ matches: m }); }, [post]);
  const saveAnnounce    = useCallback((a: SchAnnouncement[]) => { setAnnouncements(a); post({ announcements: a }); }, [post]);
  const saveMembers     = useCallback((m: SchMember[])       => { setMembers(m);     post({ members: m }); }, [post]);
  const saveNearby      = useCallback((p: SchNearbyParking[])=> { setNearbyParking(p); post({ nearbyParking: p }); }, [post]);
  const saveRotation    = useCallback((i: number)            => { setParkingRotation(i); post({ parkingRotation: i }); }, [post]);

  const saveRecords = useCallback((r: SchParkingRecord[]) => {
    setParkingRecords(r);
    post({ parkingRecords: r });
  }, [post]);

  // Update or create a parking record for an event
  const upsertParkingRecord = useCallback((eventId: string, updater: (slots: SchParkingSlot[]) => SchParkingSlot[]) => {
    setParkingRecords(prev => {
      const existing = prev.find(r => r.eventId === eventId);
      let updated: SchParkingRecord[];
      if (existing) {
        updated = prev.map(r => r.eventId === eventId ? { ...r, slots: updater(r.slots) } : r);
      } else {
        // Find event details
        const sch = schedules.find(s => s.id === eventId);
        const match = matches.find(m => m.id === eventId);
        const event = sch ?? match;
        if (!event) return prev;
        const newRecord: SchParkingRecord = {
          eventId, eventDate: event.date,
          eventType: sch ? 'schedule' : 'match',
          slots: updater([]),
          rotationStartIndex: 0,
        };
        updated = [...prev, newRecord];
      }
      post({ parkingRecords: updated });
      return updated;
    });
  }, [schedules, matches, post]);

  const handleSkip = useCallback((eventId: string, memberId: string, comment: string) => {
    upsertParkingRecord(eventId, slots => {
      const withoutMember = slots.filter(s => s.memberId !== memberId);
      return [...withoutMember, { memberId, status: 'skipped', skipComment: comment }];
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

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    window.location.href = '/login?type=team';
  };

  const tabs = [
    { key: 'home'     as Tab, label: 'ホーム',   icon: '🏠' },
    { key: 'schedule' as Tab, label: '練習',     icon: '⚽' },
    { key: 'match'    as Tab, label: '試合',     icon: '🏆' },
    { key: 'announce' as Tab, label: '連絡',     icon: '📢' },
    { key: 'member'   as Tab, label: 'メンバー', icon: '👥' },
  ];

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
            <Image src="/sch-logo.png" alt="SCH FC" width={175} height={215} className="object-contain h-14 w-auto" />
            <h1 className="text-2xl font-extrabold text-white drop-shadow">SCH Info</h1>
          </div>
          <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors">
            ログアウト
          </button>
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
          schedules={schedules} matches={matches} members={members}
          parkingRecords={parkingRecords} parkingRotation={parkingRotation}
          nearbyParking={nearbyParking}
          onSkip={handleSkip} onUnskip={handleUnskip} onMarkUsed={handleMarkUsed}
        />
      )}
      {tab === 'schedule' && <ScheduleSection schedules={schedules} onSave={saveSchedules} />}
      {tab === 'match'    && <MatchSection matches={matches} onSave={saveMatches} />}
      {tab === 'announce' && <AnnounceSection announcements={announcements} onSave={saveAnnounce} />}
      {tab === 'member'   && (
        <MemberSection
          members={members} onSaveMember={saveMembers}
          nearbyParking={nearbyParking} onSaveNearbyParking={saveNearby}
          parkingRotation={parkingRotation} onResetRotation={saveRotation}
        />
      )}
    </>
  );
}
