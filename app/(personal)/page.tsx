'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import SummaryCards from '@/components/SummaryCards';
import MilestoneSection from '@/components/MilestoneSection';
import LiftingChart from '@/components/LiftingChart';
import NoteCard from '@/components/NoteCard';
import LiftingForm from '@/components/LiftingForm';
import NoteForm from '@/components/NoteForm';
import ConfettiEffect from '@/components/ConfettiEffect';
import { BodyRecord, SchEvent } from '@/lib/types';
import { exportData, importData } from '@/lib/storage';
import BodyChart from '@/components/BodyChart';
import BodyCharts from '@/components/BodyCharts';

function todayStr() {
  const d = new Date();
  return d.getFullYear()+"/"+(String(d.getMonth()+1).padStart(2,"0"))+"/"+(String(d.getDate()).padStart(2,"0"));
}

function getOpponentDisplay(e: SchEvent): string {
  if (e.matches && e.matches.length > 0) {
    const names = e.matches.map(m => m.opponentName).filter(Boolean) as string[];
    if (names.length > 0) return `vs ${names.join('・')}`;
  }
  return e.opponentName ? `vs ${e.opponentName}` : '相手未定';
}

function getMatchScores(e: SchEvent): { myScore: number | undefined; oppScore: number | undefined } {
  const m = (e.matches && e.matches.length > 0) ? e.matches[0] : e;
  const homeScore = m.homeScore;
  const awayScore = m.awayScore;
  const isHome = (m.isHome ?? e.isHome) !== false;
  if (homeScore == null || awayScore == null) return { myScore: undefined, oppScore: undefined };
  return {
    myScore: isHome ? homeScore : awayScore,
    oppScore: isHome ? awayScore : homeScore,
  };
}

function getMatchResult(event: SchEvent): 'win' | 'loss' | 'draw' | null {
  const { myScore, oppScore } = getMatchScores(event);
  if (myScore == null || oppScore == null) return null;
  if (myScore > oppScore) return 'win';
  if (myScore < oppScore) return 'loss';
  return 'draw';
}

export default function DashboardPage() {
  const { liftingRecords, addLiftingRecord, practiceNotes, addPracticeNote, milestones, maxCount, newMilestoneAchieved, clearNewMilestone, bodyRecords, addBodyRecord, updateBodyRecord, deleteBodyRecord, childBirthDate, setChildBirthDate, isLoading } = useApp();
  const [showLiftingForm, setShowLiftingForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showBodyForm, setShowBodyForm] = useState(false);
  const [bodyWeight, setBodyWeight] = useState("");
  const [bodyHeight, setBodyHeight] = useState("");
  const [bodySleep, setBodySleep] = useState("");
  const [bodyDate, setBodyDate] = useState(todayStr());
  const [bodySaved, setBodySaved] = useState(false);
  type MergeConflict = {
    existing: BodyRecord;
    incoming: Omit<BodyRecord, 'id'>;
    choices: { weight: 'existing'|'new'; height: 'existing'|'new'; sleepTime: 'existing'|'new' };
  };
  const [mergeConflict, setMergeConflict] = useState<MergeConflict | null>(null);
  const [birthDateInput, setBirthDateInput] = useState("");
  const [matchEvents, setMatchEvents] = useState<SchEvent[]>([]);

  useEffect(() => {
    fetch('/api/sch')
      .then(r => r.json())
      .then(data => {
        const matches: SchEvent[] = (data.events ?? []).filter((e: SchEvent) => e.type === 'match');
        setMatchEvents(matches.sort((a: SchEvent, b: SchEvent) => b.date.localeCompare(a.date)));
      })
      .catch(() => {});
  }, []);
  const latestNotes = [...practiceNotes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
  const sortedBody = [...bodyRecords].sort((a, b) => b.date.localeCompare(a.date));
  const latestH = sortedBody.find(r => r.height != null);
  const latestW = sortedBody.find(r => r.weight != null);
  const pastLocations = [...new Set([...liftingRecords.map((r) => r.location), ...practiceNotes.map((n) => n.location)])];
  const pastCategories = [...new Set(practiceNotes.map((n) => n.category).filter(Boolean) as string[])];
  const pastTeamNames = [...new Set(practiceNotes.map((n) => n.teamName).filter(Boolean) as string[])];
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => { try { await importData(ev.target?.result as string); window.location.reload(); } catch { alert('インポートに失敗しました。'); } };
    reader.readAsText(file);
  };
  const finishBodySave = () => {
    setBodyWeight(""); setBodyHeight(""); setBodySleep(""); setMergeConflict(null);
    setBodySaved(true);
    setTimeout(() => { setBodySaved(false); setShowBodyForm(false); }, 1200);
  };
  const handleBodySave = (e: React.FormEvent) => {
    e.preventDefault();
    const w = bodyWeight ? parseFloat(bodyWeight.replace(',', '.')) : NaN;
    const h = bodyHeight ? parseFloat(bodyHeight.replace(',', '.')) : NaN;
    if (isNaN(w) && isNaN(h) && !bodySleep) return;
    const incoming: Omit<BodyRecord, 'id'> = { date: bodyDate };
    if (!isNaN(w) && w > 0) incoming.weight = w;
    if (!isNaN(h) && h > 0) incoming.height = h;
    if (bodySleep) incoming.sleepTime = bodySleep;
    const existing = bodyRecords.find(r => r.date === bodyDate);
    if (existing) {
      const wConflict = incoming.weight != null && existing.weight != null && incoming.weight !== existing.weight;
      const hConflict = incoming.height != null && existing.height != null && incoming.height !== existing.height;
      const sConflict = incoming.sleepTime && existing.sleepTime && incoming.sleepTime !== existing.sleepTime;
      if (wConflict || hConflict || sConflict) {
        setMergeConflict({ existing, incoming, choices: { weight: 'new', height: 'new', sleepTime: 'new' } });
        return;
      }
      // no conflict: auto-merge (fill blanks)
      updateBodyRecord(existing.id, {
        weight: incoming.weight ?? existing.weight,
        height: incoming.height ?? existing.height,
        sleepTime: incoming.sleepTime ?? existing.sleepTime,
      });
    } else {
      addBodyRecord(incoming);
    }
    finishBodySave();
  };
  const handleMergeApply = () => {
    if (!mergeConflict) return;
    const { existing, incoming, choices } = mergeConflict;
    updateBodyRecord(existing.id, {
      weight: choices.weight === 'new' ? (incoming.weight ?? existing.weight) : existing.weight,
      height: choices.height === 'new' ? (incoming.height ?? existing.height) : existing.height,
      sleepTime: choices.sleepTime === 'new' ? (incoming.sleepTime ?? existing.sleepTime) : existing.sleepTime,
    });
    finishBodySave();
  };
  // Match stats
  const finishedMatches = matchEvents.filter(e => getMatchScores(e).myScore != null);
  const wins = finishedMatches.filter(e => getMatchResult(e) === 'win').length;
  const draws = finishedMatches.filter(e => getMatchResult(e) === 'draw').length;
  const losses = finishedMatches.filter(e => getMatchResult(e) === 'loss').length;
  const goalsFor = finishedMatches.reduce((s, e) => s + (getMatchScores(e).myScore ?? 0), 0);
  const goalsAgainst = finishedMatches.reduce((s, e) => s + (getMatchScores(e).oppScore ?? 0), 0);
  const recentMatches = matchEvents.slice(0, 5);

  if (isLoading) return (<div className="flex items-center justify-center py-24 text-gray-400"><div className="text-center"><p className="text-4xl mb-3">⚽</p><p className="text-sm">読み込み中...</p></div></div>);
  return (
    <>
      <ConfettiEffect trigger={!!newMilestoneAchieved} onDone={clearNewMilestone} />
      {newMilestoneAchieved && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-yellow-400 text-yellow-900 font-bold px-6 py-3 rounded-2xl shadow-xl animate-bounce text-center whitespace-nowrap">🎉 {newMilestoneAchieved}回達成おめでとう！</div>}
      <header className="mb-5 pt-1">
        <h1 className="text-2xl font-extrabold text-white drop-shadow">⚽ サッカー記録</h1>
        <p className="text-sm text-blue-200 mt-0.5">毎日の練習を積み上げよう！💪</p>
      </header>
      <div className="mb-5 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 rounded-2xl px-4 py-3.5 text-white shadow-lg shadow-blue-900/40 border border-blue-400/30">
        <p className="text-xs font-semibold opacity-70 mb-0.5">🎯 目標</p>
        <p className="text-base font-bold">世界一のサッカー選手になる</p>
      </div>
      <section className="mb-5">
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => { const el = document.getElementById('section-lifting'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 16, behavior: 'smooth' }); }} className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-3 text-center shadow-lg shadow-blue-900/40 border border-blue-400/20 active:scale-95 transition-transform">
            <p className="text-xl mb-0.5">🏆</p>
            <p className="text-[10px] text-blue-100 leading-tight">リフティング<br/>最高</p>
            <p className="text-xl font-extrabold text-white mt-0.5">{maxCount}<span className="text-xs font-normal">回</span></p>
          </button>
          <button onClick={() => { const el = document.getElementById('section-notes'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 16, behavior: 'smooth' }); }} className="bg-gradient-to-br from-cyan-500 to-teal-600 rounded-2xl p-3 text-center shadow-lg shadow-teal-900/40 border border-cyan-400/20 active:scale-95 transition-transform">
            <p className="text-xl mb-0.5">📝</p>
            <p className="text-[10px] text-cyan-100 leading-tight">練習ノート<br/>記録数</p>
            <p className="text-xl font-extrabold text-white mt-0.5">{practiceNotes.length}<span className="text-xs font-normal">回</span></p>
          </button>
          <button onClick={() => { const el = document.getElementById('section-body'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 16, behavior: 'smooth' }); }} className="bg-gradient-to-br from-violet-500 to-indigo-700 rounded-2xl p-3 text-center shadow-lg shadow-indigo-900/40 border border-violet-400/20 active:scale-95 transition-transform">
            <p className="text-xl mb-0.5">📏</p>
            <p className="text-[10px] text-violet-100 leading-tight mb-0.5">身長 / 体重</p>
            <p className="text-sm font-extrabold text-white leading-tight">{latestH?.height ?? '-'}<span className="text-[10px] font-normal">cm</span></p>
            <p className="text-sm font-bold text-violet-200 leading-tight">{latestW?.weight ?? '-'}<span className="text-[10px] font-normal">kg</span></p>
          </button>
        </div>
      </section>
      {matchEvents.length > 0 && (
        <section id="section-matches" className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-blue-200 tracking-wide uppercase">🏆 SCH チーム戦績</h2>
            <Link href="/sch" className="text-xs text-blue-300 font-medium">詳細 →</Link>
          </div>
          {/* Summary row */}
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            <div className="bg-slate-800/80 rounded-xl p-2 text-center border border-white/10">
              <p className="text-[10px] text-slate-400">試合</p>
              <p className="text-lg font-extrabold text-white">{matchEvents.length}</p>
            </div>
            <div className="bg-blue-900/60 rounded-xl p-2 text-center border border-blue-500/30">
              <p className="text-[10px] text-blue-300">勝</p>
              <p className="text-lg font-extrabold text-blue-200">{wins}</p>
            </div>
            <div className="bg-slate-700/60 rounded-xl p-2 text-center border border-slate-500/30">
              <p className="text-[10px] text-slate-400">分</p>
              <p className="text-lg font-extrabold text-slate-300">{draws}</p>
            </div>
            <div className="bg-red-900/50 rounded-xl p-2 text-center border border-red-500/30">
              <p className="text-[10px] text-red-300">負</p>
              <p className="text-lg font-extrabold text-red-300">{losses}</p>
            </div>
            <div className="bg-emerald-900/40 rounded-xl p-2 text-center border border-emerald-500/20">
              <p className="text-[9px] text-emerald-400 leading-tight">得点/<br/>失点</p>
              <p className="text-sm font-extrabold text-emerald-300 leading-tight">{goalsFor}<span className="text-[10px] font-normal text-slate-400">/{goalsAgainst}</span></p>
            </div>
          </div>
          {/* Recent matches */}
          <div className="bg-slate-800/80 rounded-2xl overflow-hidden border border-white/10 shadow-lg">
            {recentMatches.map((e, i) => {
              const result = getMatchResult(e);
              const { myScore, oppScore } = getMatchScores(e);
              const resultColor = result === 'win' ? 'text-blue-300' : result === 'loss' ? 'text-red-400' : 'text-slate-400';
              const resultLabel = result === 'win' ? '勝' : result === 'loss' ? '負' : result === 'draw' ? '分' : '-';
              return (
                <div key={e.id} className={`flex items-center gap-2 px-3 py-2 ${i < recentMatches.length - 1 ? 'border-b border-white/5' : ''}`}>
                  <span className="text-[10px] text-slate-500 w-12 shrink-0">{e.date.slice(5).replace('/', '/')}</span>
                  <span className="text-xs text-slate-300 flex-1 truncate">{getOpponentDisplay(e)}</span>
                  {result != null ? (
                    <>
                      <span className={`text-sm font-bold ${resultColor}`}>{myScore} - {oppScore}</span>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${result === 'win' ? 'bg-blue-600/30 text-blue-300' : result === 'loss' ? 'bg-red-600/30 text-red-400' : 'bg-slate-600/40 text-slate-400'}`}>{resultLabel}</span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">結果なし</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-blue-200 mb-3 tracking-wide uppercase">✏️ 今日の記録を追加</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowLiftingForm(true)} className="flex-1 bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 text-white font-bold py-4 rounded-2xl flex flex-col items-center gap-1 shadow-lg shadow-blue-900/50 border border-blue-400/30 transition-all active:scale-95"><span className="text-2xl">⚽</span><span className="text-xs">リフティング</span></button>
          <button onClick={() => setShowNoteForm(true)} className="flex-1 bg-gradient-to-b from-teal-500 to-cyan-700 hover:from-teal-400 hover:to-cyan-600 text-white font-bold py-4 rounded-2xl flex flex-col items-center gap-1 shadow-lg shadow-cyan-900/50 border border-teal-400/30 transition-all active:scale-95"><span className="text-2xl">📝</span><span className="text-xs">練習ノート</span></button>
          <button onClick={() => setShowBodyForm(true)} className="flex-1 bg-gradient-to-b from-violet-500 to-indigo-700 hover:from-violet-400 hover:to-indigo-600 text-white font-bold py-4 rounded-2xl flex flex-col items-center gap-1 shadow-lg shadow-indigo-900/50 border border-violet-400/30 transition-all active:scale-95"><span className="text-2xl">📏</span><span className="text-xs">身長・体重</span></button>
        </div>
      </section>
      <section id="section-lifting" className="mb-6"><SummaryCards records={liftingRecords} /></section>
      <section className="mb-6"><div className="flex items-center justify-between mb-3"><h2 className="text-sm font-bold text-blue-200 tracking-wide uppercase">🏅 マイルストーン</h2><Link href="/lifting" className="text-xs text-blue-300 font-medium">もっと見る →</Link></div><MilestoneSection milestones={milestones} maxCount={maxCount} /></section>
      <section className="mb-6"><div className="flex items-center justify-between mb-3"><h2 className="text-sm font-bold text-blue-200 tracking-wide uppercase">📈 成長グラフ（インステップ左足）</h2><Link href="/lifting" className="text-xs text-blue-300 font-medium">詳細 →</Link></div><div className="bg-slate-800/80 rounded-2xl p-4 shadow-xl shadow-blue-900/40 border border-white/10"><LiftingChart records={liftingRecords} filterPart="インステップ" filterSide="左足" /></div></section>
      <section id="section-body" className="mb-6">
        <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-bold text-blue-200 tracking-wide uppercase">📏 体重・身長</h2><button onClick={() => setShowBodyForm(true)} className="text-xs bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors">+ 追加</button></div>
        {sortedBody.length > 0 ? (<div className="bg-white/95 rounded-2xl shadow-xl shadow-blue-900/30 border border-white/20 overflow-hidden">
          <div className="flex bg-slate-50 text-xs font-semibold text-gray-500 px-4 py-2 border-b border-gray-100"><span className="flex-1">日付</span><span className="w-14 text-center">体重</span><span className="w-14 text-center">身長</span><span className="w-12 text-center">就寝</span><span className="w-6"></span></div>
          {sortedBody.slice(0,5).map((r)=>(<div key={r.id} className="flex items-center px-4 py-2 border-b border-gray-50 text-sm"><span className="flex-1 text-gray-600">{r.date}</span><span className="w-14 text-center font-semibold">{r.weight ? r.weight+"kg" : "-"}</span><span className="w-14 text-center font-semibold">{r.height ? r.height+"cm" : "-"}</span><span className="w-12 text-center text-gray-500 text-xs">{r.sleepTime ?? "-"}</span><button onClick={()=>{ if(window.confirm('この記録を削除しますか？')) deleteBodyRecord(r.id); }} className="w-6 text-gray-300 hover:text-red-400 text-lg">×</button></div>))}
        </div>) : (<p className="text-sm text-blue-200/60 text-center py-4">まだ記録がありません</p>)}
        {sortedBody.length >= 1 && (
          <div className="mt-3 bg-white/95 rounded-2xl p-4 shadow-xl shadow-blue-900/30 border border-white/20">
            {!childBirthDate ? (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-2">平均・SDを表示するには生年月日を入力してください</p>
                <div className="flex gap-2">
                  <input type="date" value={birthDateInput} onChange={e=>setBirthDateInput(e.target.value)} className="flex-1 rounded-xl border-2 border-gray-200 px-3 py-2 text-sm" />
                  <button onClick={()=>setChildBirthDate(birthDateInput.split("-").join("/"))} className="bg-blue-600 text-white font-bold px-3 py-2 rounded-xl text-sm">設定</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-400">生年月日: {childBirthDate}</p>
                <button onClick={()=>setChildBirthDate("")} className="text-xs text-gray-400 hover:text-red-400">変更</button>
              </div>
            )}
            <BodyChart records={bodyRecords} birthDate={childBirthDate} />
          </div>
        )}
        <BodyCharts records={bodyRecords} birthDate={childBirthDate} />
      </section>
      <section id="section-notes" className="mb-6"><div className="flex items-center justify-between mb-3"><h2 className="text-sm font-bold text-blue-200 tracking-wide uppercase">📝 最新の練習ノート</h2><Link href="/notes" className="text-xs text-blue-300 font-medium">もっと見る →</Link></div>{latestNotes.length === 0 ? (<p className="text-sm text-blue-200/60 text-center py-4">まだノートがありません</p>) : (<div className="space-y-3">{latestNotes.map((n) => <NoteCard key={n.id} note={n} />)}</div>)}</section>
      <section className="mb-2"><h2 className="text-sm font-bold text-blue-200 tracking-wide uppercase mb-3">💾 データ管理</h2><div className="flex gap-3"><button onClick={exportData} className="flex-1 bg-blue-600/80 hover:bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm border border-blue-400/30">📤 エクスポート</button><label className="flex-1 bg-slate-600/80 hover:bg-slate-600 text-white font-bold py-2.5 rounded-xl text-sm cursor-pointer text-center border border-slate-400/30">📥 インポート<input type="file" accept=".json" onChange={handleImport} className="hidden" /></label></div></section>
      {showLiftingForm && <LiftingForm onSave={addLiftingRecord} onClose={() => setShowLiftingForm(false)} pastLocations={pastLocations} />}
      {showNoteForm && <NoteForm onSave={addPracticeNote} onClose={() => setShowNoteForm(false)} pastLocations={pastLocations} pastCategories={pastCategories} pastTeamNames={pastTeamNames} />}
      {showBodyForm && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => !bodySaved && setShowBodyForm(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl mb-16 sm:mb-0" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-8 space-y-4">
              {bodySaved ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <span className="text-5xl">✅</span>
                  <p className="text-lg font-bold text-gray-800">記録しました！</p>
                </div>
              ) : mergeConflict ? (
                /* ── マージ確認UI ── */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-gray-800">⚠️ 同じ日のデータがあります</h2>
                    <button type="button" onClick={() => setMergeConflict(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                  </div>
                  <p className="text-xs text-gray-500">{bodyDate} — どちらの値を使うか選んでください。</p>
                  {(['weight', 'height', 'sleepTime'] as const).map(field => {
                    const existVal = field === 'weight' ? (mergeConflict.existing.weight != null ? `${mergeConflict.existing.weight}kg` : null)
                      : field === 'height' ? (mergeConflict.existing.height != null ? `${mergeConflict.existing.height}cm` : null)
                      : mergeConflict.existing.sleepTime ?? null;
                    const newVal = field === 'weight' ? (mergeConflict.incoming.weight != null ? `${mergeConflict.incoming.weight}kg` : null)
                      : field === 'height' ? (mergeConflict.incoming.height != null ? `${mergeConflict.incoming.height}cm` : null)
                      : mergeConflict.incoming.sleepTime ?? null;
                    const label = field === 'weight' ? '⚖️ 体重' : field === 'height' ? '📐 身長' : '😴 就寝時刻';
                    if (!existVal && !newVal) return null;
                    if (!existVal || !newVal) return (
                      <div key={field} className="bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-600">
                        {label}: {existVal ?? newVal} <span className="text-xs text-gray-400">（自動マージ）</span>
                      </div>
                    );
                    const isConflict = existVal !== newVal;
                    if (!isConflict) return (
                      <div key={field} className="bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-600">
                        {label}: {existVal} <span className="text-xs text-gray-400">（同じ値）</span>
                      </div>
                    );
                    return (
                      <div key={field} className="border-2 border-orange-200 rounded-xl p-3 space-y-2">
                        <p className="text-xs font-bold text-orange-600">{label} — 値が異なります</p>
                        <div className="flex gap-2">
                          <button onClick={() => setMergeConflict(c => c && ({ ...c, choices: { ...c.choices, [field]: 'existing' } }))}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${mergeConflict.choices[field] === 'existing' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'}`}>
                            既存: {existVal}
                          </button>
                          <button onClick={() => setMergeConflict(c => c && ({ ...c, choices: { ...c.choices, [field]: 'new' } }))}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${mergeConflict.choices[field] === 'new' ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 text-gray-600'}`}>
                            新: {newVal}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleMergeApply} className="flex-1 bg-purple-600 text-white font-bold py-3 rounded-xl text-sm">✅ マージして保存</button>
                    <button onClick={() => setMergeConflict(null)} className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl text-sm">キャンセル</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-800">📏 身長・体重を記録</h2>
                    <button type="button" onClick={() => setShowBodyForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                  </div>
                  <form onSubmit={handleBodySave} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1">📅 日付</label>
                      <input type="date" value={bodyDate.split("/").join("-")} onChange={e => setBodyDate(e.target.value.split("-").join("/"))} className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-purple-400 focus:outline-none" />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-sm font-semibold text-gray-600 mb-1">📐 身長 (cm)</label>
                        <input type="text" inputMode="decimal" value={bodyHeight} onChange={e => setBodyHeight(e.target.value)} placeholder="例: 112.0" className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-purple-400 focus:outline-none" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-semibold text-gray-600 mb-1">⚖️ 体重 (kg)</label>
                        <input type="text" inputMode="decimal" value={bodyWeight} onChange={e => setBodyWeight(e.target.value)} placeholder="例: 18.5" className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-purple-400 focus:outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1">😴 就寝時刻 <span className="text-gray-400 font-normal text-xs">（任意）</span></label>
                      <input type="time" value={bodySleep} onChange={e => setBodySleep(e.target.value)} className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-purple-400 focus:outline-none" />
                    </div>
                    <button type="submit" className="w-full bg-purple-600 active:bg-purple-700 text-white font-bold py-3 rounded-xl text-base">💾 記録する</button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
