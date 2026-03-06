'use client';

import { useState } from 'react';
import { useApp } from '@/lib/context';
import LiftingChart from '@/components/LiftingChart';
import LiftingTable from '@/components/LiftingTable';
import LiftingForm from '@/components/LiftingForm';
import MilestoneSection from '@/components/MilestoneSection';
import PartSummaryCards from '@/components/PartSummaryCards';
import ConfettiEffect from '@/components/ConfettiEffect';
import { LiftingPart, LiftingSide, LiftingRecord } from '@/lib/types';

const PARTS: (LiftingPart | 'all')[] = ['all', 'インステップ', 'インサイド', 'アウトサイド', 'もも', '頭'];
const SIDES: (LiftingSide | 'all')[] = ['all', '左足', '右足', '両足'];

const PART_LABELS: Record<string, string> = { all: '全部位' };
const SIDE_LABELS: Record<string, string> = { all: '全部' };

export default function LiftingPage() {
  const { liftingRecords, addLiftingRecord, updateLiftingRecord, deleteLiftingRecord, milestones, maxCount, newMilestoneAchieved, clearNewMilestone, isLoading } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LiftingRecord | null>(null);
  const [filterPart, setFilterPart] = useState<LiftingPart | 'all'>('インステップ');
  const [filterSide, setFilterSide] = useState<LiftingSide | 'all'>('左足');

  const pastLocations = [...new Set(liftingRecords.map((r) => r.location))];

  const handleEditSave = (data: Omit<LiftingRecord, 'id'>) => {
    if (editingRecord) {
      updateLiftingRecord(editingRecord.id, data);
      setEditingRecord(null);
    }
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

      <header className="mb-5">
        <h1 className="text-2xl font-extrabold text-gray-800">⚽ リフティング記録</h1>
        <p className="text-sm text-gray-500 mt-0.5">全{liftingRecords.length}件の記録</p>
      </header>

      {/* 部位別サマリー */}
      <section className="mb-6">
        <h2 className="text-base font-bold text-gray-700 mb-3">📊 部位別まとめ</h2>
        <PartSummaryCards records={liftingRecords} />
      </section>

      {/* Filter */}
      <section className="mb-4">
        <div className="mb-2">
          <p className="text-xs font-semibold text-gray-500 mb-1.5">部位</p>
          <div className="flex flex-wrap gap-1.5">
            {PARTS.map((p) => (
              <button
                key={p}
                onClick={() => setFilterPart(p)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                  filterPart === p
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {PART_LABELS[p] ?? p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1.5">左右</p>
          <div className="flex gap-1.5">
            {SIDES.map((s) => (
              <button
                key={s}
                onClick={() => setFilterSide(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                  filterSide === s
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {SIDE_LABELS[s] ?? s}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Chart */}
      <section className="mb-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-3">
            📈 {filterPart === 'all' ? '全部位' : filterPart} / {filterSide === 'all' ? '全部' : filterSide}
          </p>
          <LiftingChart records={liftingRecords} filterPart={filterPart} filterSide={filterSide} />
        </div>
      </section>

      {/* Table */}
      <section className="mb-6">
        <h2 className="text-base font-bold text-gray-700 mb-3">📋 記録一覧</h2>
        <LiftingTable
          records={liftingRecords}
          filterPart={filterPart}
          filterSide={filterSide}
          onDelete={deleteLiftingRecord}
          onEdit={(r) => setEditingRecord(r)}
        />
      </section>

      {/* Milestones */}
      <section className="mb-6">
        <h2 className="text-base font-bold text-gray-700 mb-3">🏅 マイルストーン</h2>
        <MilestoneSection milestones={milestones} maxCount={maxCount} />
      </section>

      {/* FAB */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white text-2xl rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
        title="記録を追加"
      >
        ＋
      </button>

      {showForm && (
        <LiftingForm
          onSave={addLiftingRecord}
          onClose={() => setShowForm(false)}
          pastLocations={pastLocations}
        />
      )}
      {editingRecord && (
        <LiftingForm
          onSave={handleEditSave}
          onClose={() => setEditingRecord(null)}
          pastLocations={pastLocations}
          initialValues={editingRecord}
        />
      )}
    </>
  );
}
