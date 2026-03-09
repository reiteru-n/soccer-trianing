'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useApp } from '@/lib/context';
import SummaryCards from '@/components/SummaryCards';
import MilestoneSection from '@/components/MilestoneSection';
import LiftingChart from '@/components/LiftingChart';
import NoteCard from '@/components/NoteCard';
import LiftingForm from '@/components/LiftingForm';
import NoteForm from '@/components/NoteForm';
import ConfettiEffect from '@/components/ConfettiEffect';
import { BodyRecord } from '@/lib/types';
import { exportData, importData } from '@/lib/storage';
import BodyChart from '@/components/BodyChart';

function todayStr() {
  const d = new Date();
  return d.getFullYear()+"/"+(String(d.getMonth()+1).padStart(2,"0"))+"/"+(String(d.getDate()).padStart(2,"0"));
}

export default function DashboardPage() {
  const { liftingRecords, addLiftingRecord, practiceNotes, addPracticeNote, milestones, maxCount, newMilestoneAchieved, clearNewMilestone, bodyRecords, addBodyRecord, deleteBodyRecord, childBirthDate, setChildBirthDate, isLoading } = useApp();
  const [showLiftingForm, setShowLiftingForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showBodyForm, setShowBodyForm] = useState(false);
  const [bodyWeight, setBodyWeight] = useState("");
  const [bodyHeight, setBodyHeight] = useState("");
  const [bodyDate, setBodyDate] = useState(todayStr());
  const [birthDateInput, setBirthDateInput] = useState("");
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
  const handleBodySave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bodyWeight && !bodyHeight) return;
    const record: Omit<BodyRecord, 'id'> = { date: bodyDate };
    if (bodyWeight) record.weight = parseFloat(bodyWeight);
    if (bodyHeight) record.height = parseFloat(bodyHeight);
    addBodyRecord(record); setBodyWeight(""); setBodyHeight(""); setShowBodyForm(false);
  };
  if (isLoading) return (<div className="flex items-center justify-center py-24 text-gray-400"><div className="text-center"><p className="text-4xl mb-3">⚽</p><p className="text-sm">読み込み中...</p></div></div>);
  return (
    <>
      <ConfettiEffect trigger={!!newMilestoneAchieved} onDone={clearNewMilestone} />
      {newMilestoneAchieved && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-yellow-400 text-yellow-900 font-bold px-6 py-3 rounded-2xl shadow-xl animate-bounce text-center whitespace-nowrap">🎉 {newMilestoneAchieved}回達成おめでとう！</div>}
      <header className="mb-5 pt-1">
        <h1 className="text-2xl font-extrabold text-white drop-shadow">⚽ 拓渡のサッカー記録</h1>
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
        <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-bold text-blue-200 tracking-wide uppercase">📏 体重・身長</h2></div>
        {sortedBody.length > 0 ? (<div className="bg-white/95 rounded-2xl shadow-xl shadow-blue-900/30 border border-white/20 overflow-hidden">
          <div className="flex bg-slate-50 text-xs font-semibold text-gray-500 px-4 py-2 border-b border-gray-100"><span className="flex-1">日付</span><span className="w-16 text-center">体重</span><span className="w-16 text-center">身長</span><span className="w-6"></span></div>
          {sortedBody.slice(0,5).map((r)=>(<div key={r.id} className="flex items-center px-4 py-2 border-b border-gray-50 text-sm"><span className="flex-1 text-gray-600">{r.date}</span><span className="w-16 text-center font-semibold">{r.weight ? r.weight+"kg" : "-"}</span><span className="w-16 text-center font-semibold">{r.height ? r.height+"cm" : "-"}</span><button onClick={()=>{ if(window.confirm('この記録を削除しますか？')) deleteBodyRecord(r.id); }} className="w-6 text-gray-300 hover:text-red-400 text-lg">×</button></div>))}
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
      </section>
      <section id="section-notes" className="mb-6"><div className="flex items-center justify-between mb-3"><h2 className="text-sm font-bold text-blue-200 tracking-wide uppercase">📝 最新の練習ノート</h2><Link href="/notes" className="text-xs text-blue-300 font-medium">もっと見る →</Link></div>{latestNotes.length === 0 ? (<p className="text-sm text-blue-200/60 text-center py-4">まだノートがありません</p>) : (<div className="space-y-3">{latestNotes.map((n) => <NoteCard key={n.id} note={n} />)}</div>)}</section>
      <section className="mb-2"><h2 className="text-sm font-bold text-blue-200 tracking-wide uppercase mb-3">💾 データ管理</h2><div className="flex gap-3"><button onClick={exportData} className="flex-1 bg-blue-600/80 hover:bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm border border-blue-400/30">📤 エクスポート</button><label className="flex-1 bg-slate-600/80 hover:bg-slate-600 text-white font-bold py-2.5 rounded-xl text-sm cursor-pointer text-center border border-slate-400/30">📥 インポート<input type="file" accept=".json" onChange={handleImport} className="hidden" /></label></div></section>
      {showLiftingForm && <LiftingForm onSave={addLiftingRecord} onClose={() => setShowLiftingForm(false)} pastLocations={pastLocations} />}
      {showNoteForm && <NoteForm onSave={addPracticeNote} onClose={() => setShowNoteForm(false)} pastLocations={pastLocations} pastCategories={pastCategories} pastTeamNames={pastTeamNames} />}
      {showBodyForm && (
        <div className="fixed inset-0 z-50 flex items-end pb-16 sm:pb-0 sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowBodyForm(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-8 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">📏 身長・体重を記録</h2>
                <button onClick={() => setShowBodyForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>
              <form onSubmit={handleBodySave} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">📅 日付</label>
                  <input type="date" value={bodyDate.split("/").join("-")} onChange={e => setBodyDate(e.target.value.split("-").join("/"))} className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-purple-400 focus:outline-none" />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-600 mb-1">📐 身長 (cm)</label>
                    <input type="number" step="0.1" inputMode="decimal" value={bodyHeight} onChange={e => setBodyHeight(e.target.value)} placeholder="例: 112.0" className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-purple-400 focus:outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-600 mb-1">⚖️ 体重 (kg)</label>
                    <input type="number" step="0.1" inputMode="decimal" value={bodyWeight} onChange={e => setBodyWeight(e.target.value)} placeholder="例: 18.5" className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-purple-400 focus:outline-none" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl text-base">💾 記録する</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
