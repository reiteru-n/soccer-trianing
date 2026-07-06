import { LiftingRecord, PracticeNote, ImprovementItem, BodyRecord, TrainingMenuItem, TrainingLog, PerformanceRecord, CustomMetricDef, VideoCategory, VideoItem, VideoViewStat, VideoTimestamp, VideoPlaybackPosition } from './types';
import { INITIAL_LIFTING_RECORDS, INITIAL_PRACTICE_NOTES, INITIAL_TRAINING_MENU, INITIAL_BODY_RECORDS, INITIAL_VIDEO_CATEGORIES, INITIAL_VIDEOS } from './data';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * 配列を末尾（＝直近に入力されたもの）から走査し、重複と空値を除いて
 * 「直近入力順」で返す。レコードは追記されるため末尾ほど新しい。
 * 後ろに渡した配列の要素ほど新しい扱いになる。
 */
export function recentDistinct(values: (string | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

function migrateNote(note: any): PracticeNote {
  if (note.improvements == null) {
    return { ...note, improvements: [] };
  }
  if (typeof note.improvements === 'string') {
    const lines = note.improvements.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    const items: ImprovementItem[] = lines.length > 0
      ? lines.map((text: string) => ({ text, done: false }))
      : [{ text: note.improvements, done: false }];
    return { ...note, improvements: items };
  }
  if (!Array.isArray(note.improvements)) {
    return { ...note, improvements: [] };
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
  performanceRecords: PerformanceRecord[];
  customMetrics: CustomMetricDef[];
  videoCategories: VideoCategory[];
  videos: VideoItem[];
  videoStats: VideoViewStat[];
  videoTimestamps: VideoTimestamp[];
  videoPlaybackPositions: VideoPlaybackPosition[];
}

export async function fetchAllData(): Promise<AllData> {
  if (typeof window === 'undefined') {
    return {
      liftingRecords: INITIAL_LIFTING_RECORDS,
      practiceNotes: INITIAL_PRACTICE_NOTES,
      bodyRecords: INITIAL_BODY_RECORDS,
      trainingMenu: INITIAL_TRAINING_MENU,
      trainingLogs: [],
      childBirthDate: "",
      performanceRecords: [],
      customMetrics: [],
      videoCategories: INITIAL_VIDEO_CATEGORIES,
      videos: INITIAL_VIDEOS,
      videoStats: [],
      videoTimestamps: [],
      videoPlaybackPositions: [],
    };
  }
  try {
    const res = await fetch('/api/data');
    const data = await res.json();
    return {
      liftingRecords: data.liftingRecords ?? INITIAL_LIFTING_RECORDS,
      practiceNotes: (data.practiceNotes ?? INITIAL_PRACTICE_NOTES).map(migrateNote),
      bodyRecords: data.bodyRecords ?? INITIAL_BODY_RECORDS,
      trainingMenu: data.trainingMenu ?? INITIAL_TRAINING_MENU,
      trainingLogs: data.trainingLogs ?? [],
      childBirthDate: data.childBirthDate ?? "",
      performanceRecords: data.performanceRecords ?? [],
      customMetrics: data.customMetrics ?? [],
      videoCategories: data.videoCategories ?? INITIAL_VIDEO_CATEGORIES,
      videos: data.videos ?? INITIAL_VIDEOS,
      videoStats: data.videoStats ?? [],
      videoTimestamps: data.videoTimestamps ?? [],
      videoPlaybackPositions: data.videoPlaybackPositions ?? [],
    };
  } catch {
    return {
      liftingRecords: INITIAL_LIFTING_RECORDS,
      practiceNotes: INITIAL_PRACTICE_NOTES,
      bodyRecords: INITIAL_BODY_RECORDS,
      trainingMenu: INITIAL_TRAINING_MENU,
      trainingLogs: [],
      childBirthDate: "",
      performanceRecords: [],
      customMetrics: [],
      videoCategories: INITIAL_VIDEO_CATEGORIES,
      videos: INITIAL_VIDEOS,
      videoStats: [],
      videoTimestamps: [],
      videoPlaybackPositions: [],
    };
  }
}

// 保存リクエストを1本ずつ直列に送る。
// 並行に fetch すると、後から呼ばれた（＝新しい状態を持つ）リクエストの方が
// 先にサーバーに届き、その後で古い状態を積んだリクエストが遅れて上書きしてしまう
// ことがある（お気に入り等のトグルを連続操作したときにデータが消える不具合の原因）。
// 前のリクエストが完了するまで次を送らないことで、この上書きレースを防ぐ。
let saveQueue: Promise<void> = Promise.resolve();

function savePartial(body: Partial<Record<string, unknown>>): void {
  saveQueue = saveQueue.then(async () => {
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[savePartial] failed', { status: res.status, keys: Object.keys(body), body: text.slice(0, 500) });
      }
    } catch (err) {
      console.error('[savePartial] network error', { keys: Object.keys(body), err });
    }
  });
}

export function saveLiftingRecords(records: LiftingRecord[]): void { savePartial({ liftingRecords: records }); }
export function savePracticeNotes(notes: PracticeNote[]): void { savePartial({ practiceNotes: notes }); }
export function saveBodyRecords(records: BodyRecord[]): void { savePartial({ bodyRecords: records }); }
export function saveTrainingMenu(menu: TrainingMenuItem[]): void { savePartial({ trainingMenu: menu }); }
export function saveBirthDate(date: string): void { savePartial({ childBirthDate: date }); }
export function saveTrainingLogs(logs: TrainingLog[]): void { savePartial({ trainingLogs: logs }); }
export function savePerformanceRecords(records: PerformanceRecord[]): void { savePartial({ performanceRecords: records }); }
export function saveCustomMetrics(metrics: CustomMetricDef[]): void { savePartial({ customMetrics: metrics }); }
export function saveVideoCategories(cats: VideoCategory[]): void { savePartial({ videoCategories: cats }); }
export function saveVideos(videos: VideoItem[]): void { savePartial({ videos }); }
export function saveVideoStats(stats: VideoViewStat[]): void { savePartial({ videoStats: stats }); }
export function saveVideoTimestamps(timestamps: VideoTimestamp[]): void { savePartial({ videoTimestamps: timestamps }); }
export function saveVideoPlaybackPositions(positions: VideoPlaybackPosition[]): void { savePartial({ videoPlaybackPositions: positions }); }

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
