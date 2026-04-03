'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { LiftingRecord, PracticeNote, Milestone, BodyRecord, TrainingMenuItem, TrainingLog, PerformanceRecord, CustomMetricDef } from './types';
import { fetchAllData, saveLiftingRecords, savePracticeNotes, saveBodyRecords, saveTrainingMenu, saveTrainingLogs, saveBirthDate, savePerformanceRecords, saveCustomMetrics, generateId } from './storage';
import { MILESTONES } from './data';

interface AppContextType {
  liftingRecords: LiftingRecord[];
  addLiftingRecord: (record: Omit<LiftingRecord, 'id'>) => void;
  updateLiftingRecord: (id: string, data: Omit<LiftingRecord, 'id'>) => void;
  deleteLiftingRecord: (id: string) => void;
  practiceNotes: PracticeNote[];
  addPracticeNote: (note: Omit<PracticeNote, 'id'>) => string;
  updatePracticeNote: (id: string, data: Omit<PracticeNote, 'id'>) => void;
  deletePracticeNote: (id: string) => void;
  toggleImprovementItem: (noteId: string, index: number) => void;
  bodyRecords: BodyRecord[];
  addBodyRecord: (record: Omit<BodyRecord, 'id'>) => void;
  updateBodyRecord: (id: string, data: Partial<Omit<BodyRecord, 'id'>>) => void;
  deleteBodyRecord: (id: string) => void;
  trainingMenu: TrainingMenuItem[];
  addTrainingMenuItem: (item: Omit<TrainingMenuItem, 'id' | 'order'>) => void;
  updateTrainingMenuItem: (id: string, data: Omit<TrainingMenuItem, 'id' | 'order'>) => void;
  deleteTrainingMenuItem: (id: string) => void;
  reorderTrainingMenu: (items: TrainingMenuItem[]) => void;
  trainingLogs: TrainingLog[];
  toggleTrainingLogItem: (date: string, itemId: string) => void;
  milestones: Milestone[];
  maxCount: number;
  newMilestoneAchieved: number | null;
  clearNewMilestone: () => void;
  childBirthDate: string;
  setChildBirthDate: (d: string) => void;
  performanceRecords: PerformanceRecord[];
  addPerformanceRecord: (record: Omit<PerformanceRecord, 'id'>) => void;
  deletePerformanceRecord: (id: string) => void;
  customMetrics: CustomMetricDef[];
  addCustomMetric: (metric: Omit<CustomMetricDef, 'id'>) => void;
  updateCustomMetric: (id: string, updates: Partial<Omit<CustomMetricDef, 'id'>>) => void;
  deleteCustomMetric: (id: string) => void;
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
  const [bodyRecords, setBodyRecords] = useState<BodyRecord[]>([]);
  const [trainingMenu, setTrainingMenu] = useState<TrainingMenuItem[]>([]);
  const [trainingLogs, setTrainingLogs] = useState<TrainingLog[]>([]);
  const [childBirthDate, setChildBirthDateState] = useState("");
  const [performanceRecords, setPerformanceRecords] = useState<PerformanceRecord[]>([]);
  const [customMetrics, setCustomMetrics] = useState<CustomMetricDef[]>([]);
  const [newMilestoneAchieved, setNewMilestoneAchieved] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await fetchAllData();
      setLiftingRecords(data.liftingRecords);
      setPracticeNotes(data.practiceNotes);
      setBodyRecords(data.bodyRecords);
      setTrainingMenu(data.trainingMenu);
      setTrainingLogs(data.trainingLogs);
      setChildBirthDateState(data.childBirthDate ?? "");
      setPerformanceRecords(data.performanceRecords ?? []);
      setCustomMetrics(data.customMetrics ?? []);
      setIsLoading(false);
    }
    load();
  }, []);

  const maxCount = liftingRecords.length > 0 ? Math.max(...liftingRecords.map((r) => r.count)) : 0;
  const milestones = computeMilestones(maxCount);

  const addLiftingRecord = useCallback((record: Omit<LiftingRecord, 'id'>) => {
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
  }, [liftingRecords]);

  const updateLiftingRecord = useCallback((id: string, data: Omit<LiftingRecord, 'id'>) => {
    const updated = liftingRecords.map((r) => (r.id === id ? { ...data, id } : r));
    setLiftingRecords(updated);
    saveLiftingRecords(updated);
  }, [liftingRecords]);

  const deleteLiftingRecord = useCallback((id: string) => {
    const updated = liftingRecords.filter((r) => r.id !== id);
    setLiftingRecords(updated);
    saveLiftingRecords(updated);
  }, [liftingRecords]);

  const addPracticeNote = useCallback((note: Omit<PracticeNote, 'id'>) => {
    const id = generateId();
    const updated = [...practiceNotes, { ...note, id }];
    setPracticeNotes(updated);
    savePracticeNotes(updated);
    return id;
  }, [practiceNotes]);

  const updatePracticeNote = useCallback((id: string, data: Omit<PracticeNote, 'id'>) => {
    const updated = practiceNotes.map((n) => (n.id === id ? { ...data, id } : n));
    setPracticeNotes(updated);
    savePracticeNotes(updated);
  }, [practiceNotes]);

  const deletePracticeNote = useCallback((id: string) => {
    const updated = practiceNotes.filter((n) => n.id !== id);
    setPracticeNotes(updated);
    savePracticeNotes(updated);
  }, [practiceNotes]);
  const toggleImprovementItem = useCallback((noteId: string, index: number) => {
    const updated = practiceNotes.map((n) => {
      if (n.id !== noteId) return n;
      const improvements = (n.improvements ?? []).map((item, i) =>
        i === index ? { ...item, done: !item.done } : item
      );
      return { ...n, improvements };
    });
    setPracticeNotes(updated);
    savePracticeNotes(updated);
  }, [practiceNotes]);

  const addBodyRecord = useCallback((record: Omit<BodyRecord, 'id'>) => {
    const updated = [...bodyRecords, { ...record, id: generateId() }];
    setBodyRecords(updated);
    saveBodyRecords(updated);
  }, [bodyRecords]);

  const updateBodyRecord = useCallback((id: string, data: Partial<Omit<BodyRecord, 'id'>>) => {
    const updated = bodyRecords.map((r) => r.id === id ? { ...r, ...data } : r);
    setBodyRecords(updated);
    saveBodyRecords(updated);
  }, [bodyRecords]);

  const deleteBodyRecord = useCallback((id: string) => {
    const updated = bodyRecords.filter((r) => r.id !== id);
    setBodyRecords(updated);
    saveBodyRecords(updated);
  }, [bodyRecords]);

  const addTrainingMenuItem = useCallback((item: Omit<TrainingMenuItem, 'id' | 'order'>) => {
    const maxOrder = trainingMenu.length > 0 ? Math.max(...trainingMenu.map((m) => m.order)) : 0;
    const updated = [...trainingMenu, { ...item, id: generateId(), order: maxOrder + 1 }];
    setTrainingMenu(updated);
    saveTrainingMenu(updated);
  }, [trainingMenu]);

  const updateTrainingMenuItem = useCallback((id: string, data: Omit<TrainingMenuItem, 'id' | 'order'>) => {
    const updated = trainingMenu.map((m) => (m.id === id ? { ...data, id, order: m.order } : m));
    setTrainingMenu(updated);
    saveTrainingMenu(updated);
  }, [trainingMenu]);

  const deleteTrainingMenuItem = useCallback((id: string) => {
    const updated = trainingMenu.filter((m) => m.id !== id);
    setTrainingMenu(updated);
    saveTrainingMenu(updated);
  }, [trainingMenu]);

  const reorderTrainingMenu = useCallback((items: TrainingMenuItem[]) => {
    setTrainingMenu(items);
    saveTrainingMenu(items);
  }, []);

  const toggleTrainingLogItem = useCallback((date: string, itemId: string) => {
    setTrainingLogs((prev) => {
      const existing = prev.find((l) => l.date === date);
      let updated: TrainingLog[];
      if (existing) {
        const has = existing.completedItemIds.includes(itemId);
        updated = prev.map((l) =>
          l.date === date
            ? { ...l, completedItemIds: has ? l.completedItemIds.filter((id) => id !== itemId) : [...l.completedItemIds, itemId] }
            : l
        );
      } else {
        updated = [...prev, { id: generateId(), date, completedItemIds: [itemId] }];
      }
      saveTrainingLogs(updated);
      return updated;
    });
  }, []);

  const setChildBirthDate = useCallback((d: string) => { setChildBirthDateState(d); saveBirthDate(d); }, []);
  const clearNewMilestone = useCallback(() => setNewMilestoneAchieved(null), []);

  const addPerformanceRecord = useCallback((record: Omit<PerformanceRecord, 'id'>) => {
    const updated = [...performanceRecords, { ...record, id: generateId() }];
    setPerformanceRecords(updated);
    savePerformanceRecords(updated);
  }, [performanceRecords]);

  const deletePerformanceRecord = useCallback((id: string) => {
    const updated = performanceRecords.filter((r) => r.id !== id);
    setPerformanceRecords(updated);
    savePerformanceRecords(updated);
  }, [performanceRecords]);

  const addCustomMetric = useCallback((metric: Omit<CustomMetricDef, 'id'>) => {
    const id = 'custom_' + generateId();
    const updated = [...customMetrics, { ...metric, id }];
    setCustomMetrics(updated);
    saveCustomMetrics(updated);
  }, [customMetrics]);

  const updateCustomMetric = useCallback((id: string, updates: Partial<Omit<CustomMetricDef, 'id'>>) => {
    const updated = customMetrics.map((m) => m.id === id ? { ...m, ...updates } : m);
    setCustomMetrics(updated);
    saveCustomMetrics(updated);
  }, [customMetrics]);

  const deleteCustomMetric = useCallback((id: string) => {
    const updated = customMetrics.filter((m) => m.id !== id);
    setCustomMetrics(updated);
    saveCustomMetrics(updated);
  }, [customMetrics]);

  return (
    <AppContext.Provider
      value={{
        liftingRecords, addLiftingRecord, updateLiftingRecord, deleteLiftingRecord,
        practiceNotes, addPracticeNote, updatePracticeNote, deletePracticeNote, toggleImprovementItem,
        bodyRecords, addBodyRecord, updateBodyRecord, deleteBodyRecord,
        trainingMenu, addTrainingMenuItem, updateTrainingMenuItem, deleteTrainingMenuItem, reorderTrainingMenu,
        trainingLogs, toggleTrainingLogItem,
        milestones, maxCount, newMilestoneAchieved, clearNewMilestone,
        childBirthDate, setChildBirthDate,
        performanceRecords, addPerformanceRecord, deletePerformanceRecord,
        customMetrics, addCustomMetric, updateCustomMetric, deleteCustomMetric,
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
