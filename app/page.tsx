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
  const pastLocations = [...new Set([...liftingRecords.map((r) => r.location), ...practiceNotes.map((n) => n.location)])];
  const pastCategories = [...new Set(practiceNotes.map((n) => n.category).filter(Boolean) as string[])];
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
      <div className="mb-4 bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl px-4 py-3 text-white shadow-md">
        <p className="text-xs font-semibold opacity-80 mb-0.5">🎯 目標</p>
        <p className="text-base font-bold">世界一のサッカー選手になる</p>
      </div>
      <header className="mb-5"><h1 className="text-2xl font-extrabold text-gray-800">⚽ 拓渡のサッカー記録</h1><p className="text-sm text-gray-500 mt-0.5">毎日の練習を積み上げよう！💪</p></header>
      <section className="mb-6"><h2 className="text-base font-bold text-gray-700 mb-3">✏️ 今日の記録を追加</h2><div className="flex gap-3">
        <button onClick={() => setShowLiftingForm(true)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex flex-col items-center gap-1 shadow-md"><span className="text-2xl">⚽</span><span className="text-sm">リフティング</span></button>
        <button onClick={() => setShowNoteForm(true)} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl flex flex-col items-center gap-1 shadow-md"><span className="text-2xl">📝</span><span className="text-sm">練習ノート</span></button>
        <button onClick={() => setShowBodyForm(true)} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-2xl flex flex-col items-center gap-1 shadow-md"><span className="text-2xl">📏</span><span className="text-sm">身長・体重</span></button>
      </div></section>
      <section className="mb-6"><SummaryCards records={liftingRecords} /></section>
      <section className="mb-6"><div className="flex items-center justify-between mb-3"><h2 className="text-base font-bold text-gray-700">🏅 マイルストーン</h2><Link href="/lifting" className="text-xs text-blue-500 font-medium">もっと見る →</Link></div><MilestoneSection milestones={milestones} maxCount={maxCount} /></section>
      <section className="mb-6"><div className="flex items-center justify-between mb-3"><h2 className="text-base font-bold text-gray-700">📈 成長グラフ（インステップ左足）</h2><Link href="/lifting" className="text-xs text-blue-500 font-medium">詳細 →</Link></div><div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"><LiftingChart records={liftingRecords} filterPart="インステップ" filterSide="左足" /></div></section>
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3"><h2 className="text-base font-bold text-gray-700">📏 体重・身長</h2></div>
        {sortedBody.length > 0 ? (<div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex bg-gray-50 text-xs font-semibold text-gray-500 px-4 py-2 border-b border-gray-100"><span className="flex-1">日付</span><span className="w-16 text-center">体重</span><span className="w-16 text-center">身長</span><span className="w-6"></span></div>
          {sortedBody.slice(0,5).map((r)=>(<div key={r.id} className="flex items-center px-4 py-2 border-b border-gray-50 text-sm"><span className="flex-1 text-gray-600">{r.date}</span><span className="w-16 text-center font-semibold">{r.weight ? r.weight+"kg" : "-"}</span><span className="w-16 text-center font-semibold">{r.height ? r.height+"cm" : "-"}</span><button onClick={()=>{ if(window.confirm('この記録を削除しますか？')) deleteBodyRecord(r.id); }} className="w-6 text-gray-300 hover:text-red-400 text-lg">×</button></div>))}
        </div>) : (<p className="text-sm text-gray-400 text-center py-4">まだ記録がありません</p>)}
        {sortedBody.length >= 1 && (
          <div className="mt-3 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
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
      <section className="mb-6"><div className="flex items-center justify-between mb-3"><h2 className="text-base font-bold text-gray-700">📝 最新の練習ノート</h2><Link href="/notes" className="text-xs text-green-500 font-medium">もっと見る →</Link></div>{latestNotes.length === 0 ? (<p className="text-sm text-gray-400 text-center py-4">まだノートがありません</p>) : (<div className="space-y-3">{latestNotes.map((n) => <NoteCard key={n.id} note={n} />)}</div>)}</section>
      <section className="mb-2"><h2 className="text-base font-bold text-gray-700 mb-3">💾 データ管理</h2><div className="flex gap-3"><button onClick={exportData} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm">📤 エクスポート</button><label className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2.5 rounded-xl text-sm cursor-pointer text-center">📥 インポート<input type="file" accept=".json" onChange={handleImport} className="hidden" /></label></div></section>
      {showLiftingForm && <LiftingForm onSave={addLiftingRecord} onClose={() => setShowLiftingForm(false)} pastLocations={pastLocations} />}
      {showNoteForm && <NoteForm onSave={addPracticeNote} onClose={() => setShowNoteForm(false)} pastLocations={pastLocations} pastCategories={pastCategories} />}
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
