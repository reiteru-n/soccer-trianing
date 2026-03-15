'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { SchSchedule, SchMatch, SchAnnouncement } from '@/lib/types';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

type Tab = 'schedule' | 'match' | 'announce';

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
    const updated = editing ? schedules.map((s) => (s.id === editing.id ? entry : s)) : [...schedules, entry];
    onSave(updated.sort((a, b) => a.date.localeCompare(b.date)));
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('削除しますか？')) onSave(schedules.filter((s) => s.id !== id));
  };

  const sorted = [...schedules].sort((a, b) => a.date.localeCompare(b.date));
  const today = todayStr();
  const upcoming = sorted.filter((s) => s.date >= today);
  const past = sorted.filter((s) => s.date < today);

  return (
    <div className="space-y-3">
      <button onClick={() => setShowForm(true)} className="w-full bg-gradient-to-r from-green-600 to-emerald-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
        <span className="text-lg">＋</span> 練習予定を追加
      </button>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end pb-0 sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={resetForm}>
          <div className="bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-6 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-bold text-white">{editing ? '練習予定を編集' : '練習予定を追加'}</h3>
                <button onClick={resetForm} className="text-slate-400 text-2xl leading-none">&times;</button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">📅 日付</label>
                  <input type="date" value={date.split('/').join('-')} onChange={(e) => setDate(e.target.value.split('-').join('/'))} required className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-green-400 focus:outline-none" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">⏰ 開始</label>
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-green-400 focus:outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">⏰ 終了</label>
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-green-400 focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">📍 場所</label>
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} required placeholder="例: ○○グラウンド" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-green-400 focus:outline-none placeholder-slate-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">📝 メモ</label>
                  <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="持ち物・注意事項など" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-green-400 focus:outline-none placeholder-slate-500" />
                </div>
                <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl text-sm">保存</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-8">練習予定がありません</p>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          {upcoming.map((s) => (
            <ScheduleCard key={s.id} item={s} onEdit={openEdit} onDelete={handleDelete} highlight />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-slate-500 cursor-pointer select-none mb-2">過去の予定 ({past.length}件)</summary>
          <div className="space-y-2 opacity-60">
            {[...past].reverse().map((s) => (
              <ScheduleCard key={s.id} item={s} onEdit={openEdit} onDelete={handleDelete} highlight={false} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ScheduleCard({ item, onEdit, onDelete, highlight }: { item: SchSchedule; onEdit: (s: SchSchedule) => void; onDelete: (id: string) => void; highlight: boolean }) {
  return (
    <div className={`rounded-xl p-3 border ${highlight ? 'bg-slate-800/80 border-green-500/30' : 'bg-slate-800/40 border-white/5'}`}>
      <div className="flex items-start gap-2">
        <div className={`text-lg font-bold px-2 py-1 rounded-lg text-center min-w-[48px] ${highlight ? 'bg-green-600/20 text-green-300' : 'bg-slate-700 text-slate-400'}`}>
          <p className="text-[10px] font-normal">{item.date.slice(5).replace('/', '/')}</p>
          <p className="text-xs leading-tight">{['日', '月', '火', '水', '木', '金', '土'][new Date(item.date.replace(/\//g, '-')).getDay()]}</p>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">📍 {item.location}</p>
          {(item.startTime || item.endTime) && (
            <p className="text-xs text-slate-400 mt-0.5">⏰ {item.startTime ?? ''}{item.startTime && item.endTime ? ' 〜 ' : ''}{item.endTime ?? ''}</p>
          )}
          {item.note && <p className="text-xs text-slate-400 mt-0.5 truncate">📝 {item.note}</p>}
        </div>
        <div className="flex gap-1">
          <button onClick={() => onEdit(item)} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700">編集</button>
          <button onClick={() => onDelete(item.id)} className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-slate-700">削除</button>
        </div>
      </div>
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

  const resetForm = () => {
    setDate(todayStr()); setStartTime(''); setOpponent(''); setLocation('');
    setHomeScore(''); setAwayScore(''); setIsHome(true); setNote(''); setEditing(null); setShowForm(false);
  };

  const openEdit = (m: SchMatch) => {
    setEditing(m); setDate(m.date); setStartTime(m.startTime ?? ''); setOpponent(m.opponent ?? '');
    setLocation(m.location ?? ''); setHomeScore(m.homeScore != null ? String(m.homeScore) : '');
    setAwayScore(m.awayScore != null ? String(m.awayScore) : ''); setIsHome(m.isHome ?? true);
    setNote(m.note ?? ''); setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: SchMatch = {
      id: editing?.id ?? generateId(), date, startTime: startTime || undefined,
      opponent: opponent || undefined, location: location || undefined,
      homeScore: homeScore !== '' ? Number(homeScore) : undefined,
      awayScore: awayScore !== '' ? Number(awayScore) : undefined,
      isHome, note: note || undefined,
    };
    const updated = editing ? matches.map((m) => (m.id === editing.id ? entry : m)) : [...matches, entry];
    onSave(updated.sort((a, b) => a.date.localeCompare(b.date)));
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('削除しますか？')) onSave(matches.filter((m) => m.id !== id));
  };

  const sorted = [...matches].sort((a, b) => b.date.localeCompare(a.date));
  const today = todayStr();

  return (
    <div className="space-y-3">
      <button onClick={() => setShowForm(true)} className="w-full bg-gradient-to-r from-red-600 to-rose-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
        <span className="text-lg">＋</span> 試合を追加
      </button>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end pb-0 sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={resetForm}>
          <div className="bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-6 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-bold text-white">{editing ? '試合を編集' : '試合を追加'}</h3>
                <button onClick={resetForm} className="text-slate-400 text-2xl leading-none">&times;</button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">📅 日付</label>
                  <input type="date" value={date.split('/').join('-')} onChange={(e) => setDate(e.target.value.split('-').join('/'))} required className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-red-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">⏰ キックオフ</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-red-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">🆚 対戦相手</label>
                  <input type="text" value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="例: ○○FC" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-red-400 focus:outline-none placeholder-slate-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">📍 会場</label>
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例: ○○グラウンド" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-red-400 focus:outline-none placeholder-slate-500" />
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-xs font-semibold text-slate-400">ホーム/アウェー:</label>
                  <button type="button" onClick={() => setIsHome(true)} className={`px-3 py-1 rounded-lg text-xs font-bold ${isHome ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>ホーム</button>
                  <button type="button" onClick={() => setIsHome(false)} className={`px-3 py-1 rounded-lg text-xs font-bold ${!isHome ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400'}`}>アウェー</button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">SCH 得点</label>
                    <input type="number" min="0" value={homeScore} onChange={(e) => setHomeScore(e.target.value)} placeholder="-" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm text-center focus:border-red-400 focus:outline-none" />
                  </div>
                  <div className="self-end pb-2.5 text-slate-400 font-bold">−</div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">相手 得点</label>
                    <input type="number" min="0" value={awayScore} onChange={(e) => setAwayScore(e.target.value)} placeholder="-" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm text-center focus:border-red-400 focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">📝 メモ</label>
                  <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="大会名・備考など" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-red-400 focus:outline-none placeholder-slate-500" />
                </div>
                <button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-sm">保存</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {sorted.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-8">試合記録がありません</p>
      )}

      <div className="space-y-2">
        {sorted.map((m) => {
          const isUpcoming = m.date >= today;
          const hasScore = m.homeScore != null && m.awayScore != null;
          const won = hasScore && m.homeScore! > m.awayScore!;
          const lost = hasScore && m.homeScore! < m.awayScore!;
          const drew = hasScore && m.homeScore! === m.awayScore!;
          return (
            <div key={m.id} className={`rounded-xl p-3 border ${isUpcoming ? 'bg-slate-800/80 border-red-500/30' : 'bg-slate-800/40 border-white/5'}`}>
              <div className="flex items-start gap-2">
                <div className={`text-center px-2 py-1 rounded-lg min-w-[48px] ${isUpcoming ? 'bg-red-600/20 text-red-300' : 'bg-slate-700 text-slate-400'}`}>
                  <p className="text-[10px]">{m.date.slice(5).replace('/', '/')}</p>
                  <p className="text-xs">{['日', '月', '火', '水', '木', '金', '土'][new Date(m.date.replace(/\//g, '-')).getDay()]}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">🆚 {m.opponent ?? '相手未定'}</p>
                    {hasScore && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${won ? 'bg-green-600/30 text-green-300' : lost ? 'bg-red-600/30 text-red-300' : 'bg-slate-600/30 text-slate-300'}`}>
                        {won ? '勝' : lost ? '負' : '分'}
                      </span>
                    )}
                  </div>
                  {hasScore && (
                    <p className="text-lg font-extrabold text-white mt-0.5">
                      {m.homeScore} <span className="text-slate-400 text-sm font-normal">−</span> {m.awayScore}
                    </p>
                  )}
                  {!hasScore && isUpcoming && m.startTime && (
                    <p className="text-xs text-slate-400">⏰ {m.startTime} キックオフ</p>
                  )}
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

// ---- Announcement Section ----
function AnnounceSection({ announcements, onSave }: { announcements: SchAnnouncement[]; onSave: (a: SchAnnouncement[]) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SchAnnouncement | null>(null);
  const [date, setDate] = useState(todayStr());
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [important, setImportant] = useState(false);

  const resetForm = () => { setDate(todayStr()); setTitle(''); setContent(''); setImportant(false); setEditing(null); setShowForm(false); };

  const openEdit = (a: SchAnnouncement) => {
    setEditing(a); setDate(a.date); setTitle(a.title); setContent(a.content); setImportant(a.important ?? false); setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    const entry: SchAnnouncement = { id: editing?.id ?? generateId(), date, title, content, important };
    const updated = editing ? announcements.map((a) => (a.id === editing.id ? entry : a)) : [...announcements, entry];
    onSave(updated.sort((a, b) => b.date.localeCompare(a.date)));
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('削除しますか？')) onSave(announcements.filter((a) => a.id !== id));
  };

  const sorted = [...announcements].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-3">
      <button onClick={() => setShowForm(true)} className="w-full bg-gradient-to-r from-purple-600 to-violet-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
        <span className="text-lg">＋</span> お知らせを投稿
      </button>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end pb-0 sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={resetForm}>
          <div className="bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-6 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-bold text-white">{editing ? 'お知らせを編集' : 'お知らせを投稿'}</h3>
                <button onClick={resetForm} className="text-slate-400 text-2xl leading-none">&times;</button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">📅 日付</label>
                  <input type="date" value={date.split('/').join('-')} onChange={(e) => setDate(e.target.value.split('-').join('/'))} required className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-purple-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">📌 タイトル</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="例: 次回練習のお知らせ" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-purple-400 focus:outline-none placeholder-slate-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">📝 内容</label>
                  <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={4} placeholder="お知らせの内容を入力" className="w-full rounded-xl border-2 border-slate-600 bg-slate-900 text-white px-3 py-2.5 text-sm focus:border-purple-400 focus:outline-none placeholder-slate-500 resize-none" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} className="w-4 h-4 accent-red-500" />
                  <span className="text-sm text-slate-300">🔴 重要なお知らせとしてマーク</span>
                </label>
                <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl text-sm">投稿</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {sorted.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-8">お知らせがありません</p>
      )}

      <div className="space-y-2">
        {sorted.map((a) => (
          <div key={a.id} className={`rounded-xl p-4 border ${a.important ? 'bg-red-900/20 border-red-500/40' : 'bg-slate-800/60 border-white/10'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {a.important && <span className="text-xs font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">重要</span>}
                  <span className="text-xs text-slate-400">{a.date}</span>
                </div>
                <p className="text-sm font-bold text-white">{a.title}</p>
                <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap">{a.content}</p>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => openEdit(a)} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700">編集</button>
                <button onClick={() => handleDelete(a.id)} className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-slate-700">削除</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Main Page ----
export default function SchPage() {
  const [tab, setTab] = useState<Tab>('announce');
  const [schedules, setSchedules] = useState<SchSchedule[]>([]);
  const [matches, setMatches] = useState<SchMatch[]>([]);
  const [announcements, setAnnouncements] = useState<SchAnnouncement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sch')
      .then((r) => r.json())
      .then((d) => {
        setSchedules(d.schedules ?? []);
        setMatches(d.matches ?? []);
        setAnnouncements(d.announcements ?? []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const saveSchedules = useCallback((s: SchSchedule[]) => {
    setSchedules(s);
    fetch('/api/sch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schedules: s }) }).catch(console.error);
  }, []);

  const saveMatches = useCallback((m: SchMatch[]) => {
    setMatches(m);
    fetch('/api/sch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matches: m }) }).catch(console.error);
  }, []);

  const saveAnnouncements = useCallback((a: SchAnnouncement[]) => {
    setAnnouncements(a);
    fetch('/api/sch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ announcements: a }) }).catch(console.error);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    window.location.href = '/login?type=team';
  };

  const tabs = [
    { key: 'announce' as Tab, label: 'お知らせ', icon: '📢', count: announcements.filter((a) => a.important).length },
    { key: 'schedule' as Tab, label: 'スケジュール', icon: '📅', count: schedules.filter((s) => s.date >= todayStr()).length },
    { key: 'match' as Tab, label: '試合', icon: '⚽', count: matches.filter((m) => m.date >= todayStr()).length },
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
            <Image src="/SCHロゴ.png" alt="SCH FC" width={56} height={56} className="object-contain" />
            <div>
              <h1 className="text-2xl font-extrabold text-white drop-shadow">SCH チームページ</h1>
              <p className="text-sm text-green-300 mt-0.5">保護者専用ページ</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors">
            ログアウト
          </button>
        </div>
      </header>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="bg-green-600/20 border border-green-500/30 rounded-xl p-3 text-center">
          <p className="text-xl font-extrabold text-green-300">{schedules.filter((s) => s.date >= todayStr()).length}</p>
          <p className="text-[10px] text-green-400">今後の練習</p>
        </div>
        <div className="bg-red-600/20 border border-red-500/30 rounded-xl p-3 text-center">
          <p className="text-xl font-extrabold text-red-300">{matches.filter((m) => m.date >= todayStr()).length}</p>
          <p className="text-[10px] text-red-400">今後の試合</p>
        </div>
        <div className="bg-purple-600/20 border border-purple-500/30 rounded-xl p-3 text-center">
          <p className="text-xl font-extrabold text-purple-300">{announcements.length}</p>
          <p className="text-[10px] text-purple-400">お知らせ</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-800/60 rounded-xl p-1 mb-5 border border-white/10">
        {tabs.map(({ key, label, icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all ${tab === key ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-300'}`}
          >
            <span>{icon}</span>
            <span>{label}</span>
            {count > 0 && <span className={`text-[10px] font-bold px-1.5 rounded-full ${tab === key ? 'bg-blue-500 text-white' : 'bg-slate-600 text-slate-300'}`}>{count}</span>}
          </button>
        ))}
      </div>

      {tab === 'schedule' && <ScheduleSection schedules={schedules} onSave={saveSchedules} />}
      {tab === 'match' && <MatchSection matches={matches} onSave={saveMatches} />}
      {tab === 'announce' && <AnnounceSection announcements={announcements} onSave={saveAnnouncements} />}
    </>
  );
}
