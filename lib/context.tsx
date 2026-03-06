'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { LiftingRecord, PracticeNote, Milestone } from './types';
import { getLiftingRecords, saveLiftingRecords, getPracticeNotes, savePracticeNotes, generateId } from './storage';
import { MILESTONES } from './data';

interface AppContextType {
  liftingRecords: LiftingRecord[];
  addLiftingRecord: (record: Omit<LiftingRecord, 'id'>) => void;
  updateLiftingRecord: (id: string, data: Omit<LiftingRecord, 'id'>) => void;
  deleteLiftingRecord: (id: string) => void;
  practiceNotes: PracticeNote[];
  addPracticeNote: (note: Omit<PracticeNote, 'id'>) => void;
  updatePracticeNote: (id: string, data: Omit<PracticeNote, 'id'>) => void;
  deletePracticeNote: (id: string) => void;
  toggleImprovementItem: (noteId: string, index: number) => void;
  milestones: Milestone[];
  maxCount: number;
  newMilestoneAchieved: number | null;
  clearNewMilestone: () => void;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

function computeMilestones(max: number): Milestone[] {
  let firstUnchallenged = false;
  return MILESTONES.map((target) => {
    if (max >= target) return { target, status: 'achieved' as const };
    if (!firstUnchallenged) {
      firstUnchallenged = true;
      return { target, status: 'challenging' as const };
    }
    return { target, status: 'locked' as const };
  });
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [liftingRecords, setLiftingRecords] = useState<LiftingRecord[]>([]);
  const [practiceNotes, setPracticeNotes] = useState<PracticeNote[]>([]);
  const [newMilestoneAchieved, setNewMilestoneAchieved] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [lifting, notes] = await Promise.all([
        getLiftingRecords(),
        getPracticeNotes(),
      ]);
      setLiftingRecords(lifting);
      setPracticeNotes(notes);
      setIsLoading(false);
    }
    load();
  }, []);

  const maxCount = liftingRecords.length > 0 ? Math.max(...liftingRecords.map((r) => r.count)) : 0;
  const milestones = computeMilestones(maxCount);

  const addLiftingRecord = useCallback(
    (record: Omit<LiftingRecord, 'id'>) => {
      const prevMax = liftingRecords.length > 0 ? Math.max(...liftingRecords.map((r) => r.count)) : 0;
      const newRecord = { ...record, id: generateId() };
      const updated = [...liftingRecords, newRecord];
      setLiftingRecords(updated);
      saveLiftingRecords(updated);

      const newMax = Math.max(prevMax, record.count);
      if (newMax > prevMax) {
        const achieved = MILESTONES.filter((m) => m <= newMax && m > prevMax);
        if (achieved.length > 0) setNewMilestoneAchieved(achieved[achieved.length - 1]);
      }
    },
    [liftingRecords]
  );

  const updateLiftingRecord = useCallback(
    (id: string, data: Omit<LiftingRecord, 'id'>) => {
      const updated = liftingRecords.map((r) => (r.id === id ? { ...data, id } : r));
      setLiftingRecords(updated);
      saveLiftingRecords(updated);
    },
    [liftingRecords]
  );

  const deleteLiftingRecord = useCallback(
    (id: string) => {
      const updated = liftingRecords.filter((r) => r.id !== id);
      setLiftingRecords(updated);
      saveLiftingRecords(updated);
    },
    [liftingRecords]
  );

  const addPracticeNote = useCallback(
    (note: Omit<PracticeNote, 'id'>) => {
      const newNote = { ...note, id: generateId() };
      const updated = [...practiceNotes, newNote];
      setPracticeNotes(updated);
      savePracticeNotes(updated);
    },
    [practiceNotes]
  );

  const updatePracticeNote = useCallback(
    (id: string, data: Omit<PracticeNote, 'id'>) => {
      const updated = practiceNotes.map((n) => (n.id === id ? { ...data, id } : n));
      setPracticeNotes(updated);
      savePracticeNotes(updated);
    },
    [practiceNotes]
  );

  const deletePracticeNote = useCallback(
    (id: string) => {
      const updated = practiceNotes.filter((n) => n.id !== id);
      setPracticeNotes(updated);
      savePracticeNotes(updated);
    },
    [practiceNotes]
  );

  const toggleImprovementItem = useCallback(
    (noteId: string, index: number) => {
      const updated = practiceNotes.map((n) => {
        if (n.id !== noteId) return n;
        const improvements = n.improvements.map((item, i) =>
          i === index ? { ...item, done: !item.done } : item
        );
        return { ...n, improvements };
      });
      setPracticeNotes(updated);
      savePracticeNotes(updated);
    },
    [practiceNotes]
  );

  const clearNewMilestone = useCallback(() => setNewMilestoneAchieved(null), []);

  return (
    <AppContext.Provider
      value={{
        liftingRecords,
        addLiftingRecord,
        updateLiftingRecord,
        deleteLiftingRecord,
        practiceNotes,
        addPracticeNote,
        updatePracticeNote,
        deletePracticeNote,
        toggleImprovementItem,
        milestones,
        maxCount,
        newMilestoneAchieved,
        clearNewMilestone,
        isLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
