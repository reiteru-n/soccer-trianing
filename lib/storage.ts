import { LiftingRecord, PracticeNote, ImprovementItem } from './types';
import { INITIAL_LIFTING_RECORDS, INITIAL_PRACTICE_NOTES } from './data';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Migrate old notes where improvements was a plain string
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

async function fetchAllData(): Promise<{ liftingRecords: LiftingRecord[]; practiceNotes: PracticeNote[] }> {
  const res = await fetch('/api/data');
  return res.json();
}

async function saveData(body: { liftingRecords?: LiftingRecord[]; practiceNotes?: PracticeNote[] }): Promise<void> {
  await fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getLiftingRecords(): Promise<LiftingRecord[]> {
  if (typeof window === 'undefined') return INITIAL_LIFTING_RECORDS;
  try {
    const data = await fetchAllData();
    return data.liftingRecords ?? INITIAL_LIFTING_RECORDS;
  } catch {
    return INITIAL_LIFTING_RECORDS;
  }
}

export function saveLiftingRecords(records: LiftingRecord[]): void {
  saveData({ liftingRecords: records }).catch(console.error);
}

export async function getPracticeNotes(): Promise<PracticeNote[]> {
  if (typeof window === 'undefined') return INITIAL_PRACTICE_NOTES;
  try {
    const data = await fetchAllData();
    return (data.practiceNotes ?? INITIAL_PRACTICE_NOTES).map(migrateNote);
  } catch {
    return INITIAL_PRACTICE_NOTES;
  }
}

export function savePracticeNotes(notes: PracticeNote[]): void {
  saveData({ practiceNotes: notes }).catch(console.error);
}

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
  await saveData({
    liftingRecords: data.liftingRecords,
    practiceNotes: data.practiceNotes,
  });
}
