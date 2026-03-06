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
import { exportData, importData } from '@/lib/storage';

export default function DashboardPage() {
  const {
    liftingRecords, addLiftingRecord,
    practiceNotes, addPracticeNote,
    milestones, maxCount,
    newMilestoneAchieved, clearNewMilestone,
    isLoading,
  } = useApp();

  const [showLiftingForm, setShowLiftingForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);

  const latestNotes = [...practiceNotes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
  const pastLocations = [...new Set([
    ...liftingRecords.map((r) => r.location),
    ...practiceNotes.map((n) => n.location),
  ])];

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await importData(ev.target?.result as string);
        window.location.reload();
      } catch {
        alert('インポートに失敗しました。ファイルを確認してください。');
      }
    };
    reader.readAsText(file);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <div className="text-center">
          <p className="text-4xl mb-3">⚽</p>
          <p className="text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ConfettiEffect trigger={!!newMilestoneAchieved} onDone={clearNewMilestone} />

      {newMilestoneAchieved && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-yellow-400 text-yellow-900 font-bold px-6 py-3 rounded-2xl shadow-xl animate-bounce text-center whitespace-nowrap">
          🎉 {newMilestoneAchieved}回達成おめでとう！
        </div>
      )}

      {/* Header */}
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold text-gray-800">⚽ 拓渡のサッカー記録</h1>
        <p className="text-sm text-gray-500 mt-0.5">毎日の練習を積み上げよう！💪</p>
      </header>

      {/* 今日の記録を追加 */}
      <section className="mb-6">
        <h2 className="text-base font-bold text-gray-700 mb-3">✏️ 今日の記録を追加</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowLiftingForm(true)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-4 rounded-2xl flex flex-col items-center gap-1 shadow-md transition-colors"
          >
            <span className="text-2xl">⚽</span>
            <span className="text-sm">リフティング</span>
          </button>
          <button
            onClick={() => setShowNoteForm(true)}
            className="flex-1 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold py-4 rounded-2xl flex flex-col items-center gap-1 shadow-md transition-colors"
          >
            <span className="text-2xl">📝</span>
            <span className="text-sm">練習ノート</span>
          </button>
        </div>
      </section>

      {/* Summary */}
      <section className="mb-6">
        <SummaryCards records={liftingRecords} />
      </section>

      {/* Milestones */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-700">🏅 マイルストーン</h2>
          <Link href="/lifting" className="text-xs text-blue-500 font-medium">もっと見る →</Link>
        </div>
        <MilestoneSection milestones={milestones} maxCount={maxCount} />
      </section>

      {/* Growth Chart */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-700">📈 成長グラフ（インステップ左足）</h2>
          <Link href="/lifting" className="text-xs text-blue-500 font-medium">詳細 →</Link>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <LiftingChart records={liftingRecords} filterPart="インステップ" filterSide="左足" />
        </div>
      </section>

      {/* Latest notes */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-700">📝 最新の練習ノート</h2>
          <Link href="/notes" className="text-xs text-green-500 font-medium">もっと見る →</Link>
        </div>
        {latestNotes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">まだノートがありません</p>
        ) : (
          <div className="space-y-3">
            {latestNotes.map((n) => <NoteCard key={n.id} note={n} />)}
          </div>
        )}
      </section>

      {/* Data management */}
      <section className="mb-2">
        <h2 className="text-base font-bold text-gray-700 mb-3">💾 データ管理</h2>
        <div className="flex gap-3">
          <button
            onClick={exportData}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
          >
            📤 エクスポート
          </button>
          <label className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors cursor-pointer text-center">
            📥 インポート
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </section>

      {/* Forms */}
      {showLiftingForm && (
        <LiftingForm
          onSave={addLiftingRecord}
          onClose={() => setShowLiftingForm(false)}
          pastLocations={pastLocations}
        />
      )}
      {showNoteForm && (
        <NoteForm
          onSave={addPracticeNote}
          onClose={() => setShowNoteForm(false)}
          pastLocations={pastLocations}
        />
      )}
    </>
  );
}
