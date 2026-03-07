import { LiftingRecord, PracticeNote, ImprovementItem, BodyRecord, TrainingMenuItem, TrainingLog } from './types';
import { INITIAL_LIFTING_RECORDS, INITIAL_PRACTICE_NOTES, INITIAL_TRAINING_MENU } from './data';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function migrateNote(note: any): PracticeNote {
  if (typeof note.improvements === 'string') {
    const lines = note.improvements.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    const items: ImprovementItem[] = lines.length > 0
      ? lines.map((text: string) => ({ text, done: false }))
      : [{ text: note.improvements, done: false }];
    return { ...note, improvements: items };
  }
  return note as PracticeNote;
}

export interface AllData {
  liftingRecords: LiftingRecord[];
  practiceNotes: PracticeNote[];
  bodyRecords: BodyRecord[];
  trainingMenu: TrainingMenuItem[];
  trainingLogs: TrainingLog[];
  childBirthDate: string;
}

export async function fetchAllData(): Promise<AllData> {
  if (typeof window === 'undefined') {
    return {
      liftingRecords: INITIAL_LIFTING_RECORDS,
      practiceNotes: INITIAL_PRACTICE_NOTES,
      bodyRecords: [],
      trainingMenu: INITIAL_TRAINING_MENU,
      trainingLogs: [],
      childBirthDate: "",
    };
  }
  try {
    const res = await fetch('/api/data');
    const data = await res.json();
    return {
      liftingRecords: data.liftingRecords ?? INITIAL_LIFTING_RECORDS,
      practiceNotes: (data.practiceNotes ?? INITIAL_PRACTICE_NOTES).map(migrateNote),
      bodyRecords: data.bodyRecords ?? [],
      trainingMenu: data.trainingMenu ?? INITIAL_TRAINING_MENU,
      trainingLogs: data.trainingLogs ?? [],
      childBirthDate: data.childBirthDate ?? "",
    };
  } catch {
    return {
      liftingRecords: INITIAL_LIFTING_RECORDS,
      practiceNotes: INITIAL_PRACTICE_NOTES,
      bodyRecords: [],
      trainingMenu: INITIAL_TRAINING_MENU,
      trainingLogs: [],
      childBirthDate: "",
    };
  }
}

function savePartial(body: Partial<Record<string, unknown>>): void {
  fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(console.error);
}

export function saveLiftingRecords(records: LiftingRecord[]): void { savePartial({ liftingRecords: records }); }
export function savePracticeNotes(notes: PracticeNote[]): void { savePartial({ practiceNotes: notes }); }
export function saveBodyRecords(records: BodyRecord[]): void { savePartial({ bodyRecords: records }); }
export function saveTrainingMenu(menu: TrainingMenuItem[]): void { savePartial({ trainingMenu: menu }); }
export function saveBirthDate(date: string): void { savePartial({ childBirthDate: date }); }
export function saveTrainingLogs(logs: TrainingLog[]): void { savePartial({ trainingLogs: logs }); }

export async function exportData(): Promise<void> {
  const data = await fetchAllData();
  const blob = new Blob(
    [JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `takuto-soccer-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importData(json: string): Promise<void> {
  const data = JSON.parse(json);
  await fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      liftingRecords: data.liftingRecords,
      practiceNotes: data.practiceNotes,
      bodyRecords: data.bodyRecords,
      trainingMenu: data.trainingMenu,
      trainingLogs: data.trainingLogs,
      childBirthDate: data.childBirthDate,
    }),
  });
}
