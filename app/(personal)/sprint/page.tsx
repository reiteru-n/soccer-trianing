'use client';

import { useState } from 'react';
import { useApp } from '@/lib/context';
import SprintChart from '@/components/SprintChart';
import SprintTable from '@/components/SprintTable';
import SprintForm from '@/components/SprintForm';
import { SprintRecord } from '@/lib/types';
import { recentDistinct } from '@/lib/storage';
import { TimerIcon, ChartIcon, ClipboardIcon, TrophyIcon } from '@/components/AppIcons';

export default function SprintPage() {
  const { sprintRecords, addSprintRecord, updateSprintRecord, deleteSprintRecord, childBirthDate, isLoading } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SprintRecord | null>(null);

  const pastLocations = recentDistinct(sprintRecords.map((r) => r.location));
  const pastMethods = recentDistinct(sprintRecords.map((r) => r.method));
  const bestTime = sprintRecords.length > 0 ? Math.min(...sprintRecords.map((r) => r.timeSeconds)) : null;

  const handleEditSave = (data: Omit<SprintRecord, 'id'>) => {
    if (editingRecord) {
      updateSprintRecord(editingRecord.id, data);
      setEditingRecord(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <div className="text-center">
          <TimerIcon size={48} className="mx-auto mb-3 opacity-60" />
          <p className="text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2"><TimerIcon size={24} />50m走記録</h1>
        <p className="text-sm text-gray-500 mt-0.5">全{sprintRecords.length}件の記録</p>
      </header>

      {/* ベストタイム */}
      <section className="mb-6">
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-4 text-center shadow-lg shadow-orange-900/30 text-white">
          <p className="text-xs font-semibold opacity-80 flex items-center justify-center gap-1"><TrophyIcon size={14} />ベストタイム</p>
          <p className="text-3xl font-extrabold mt-1">{bestTime !== null ? bestTime : '-'}<span className="text-base font-normal ml-1">秒</span></p>
        </div>
      </section>

      {/* Chart */}
      <section className="mb-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1">
            <ChartIcon size={14} />タイムの推移
          </p>
          <SprintChart records={sprintRecords} birthDate={childBirthDate} />
        </div>
      </section>

      {/* Table */}
      <section className="mb-6">
        <h2 className="text-base font-bold text-gray-700 mb-3 flex items-center gap-1.5"><ClipboardIcon size={16} />記録一覧</h2>
        <SprintTable
          records={sprintRecords}
          onDelete={deleteSprintRecord}
          onEdit={(r) => setEditingRecord(r)}
        />
      </section>

      {/* FAB */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 bg-orange-600 hover:bg-orange-700 text-white text-2xl rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
        title="記録を追加"
      >
        ＋
      </button>

      {showForm && (
        <SprintForm
          onSave={addSprintRecord}
          onClose={() => setShowForm(false)}
          pastLocations={pastLocations}
          pastMethods={pastMethods}
        />
      )}
      {editingRecord && (
        <SprintForm
          onSave={handleEditSave}
          onClose={() => setEditingRecord(null)}
          pastLocations={pastLocations}
          pastMethods={pastMethods}
          initialValues={editingRecord}
        />
      )}
    </>
  );
}
