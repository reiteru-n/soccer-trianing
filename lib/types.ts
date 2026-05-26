// --- Performance / Growth tracking ---
export type PerformanceMetricType =
  | 'sprint'
  | 'rope_endurance'
  | 'rope_speed'
  | 'side_jump'
  | 'pass_direct'
  | 'pass_trap'
  | 'dribble'
  | 'kick_height'
  | 'kick_distance'
  | string; // allows custom metric ids

export type PerformanceFrequency = 'daily' | 'weekly' | 'monthly' | 'irregular';

export interface PerformanceRecord {
  id: string;
  date: string; // yyyy/mm/dd
  metricType: string; // predefined PerformanceMetricType or custom id
  value: number;
  memo?: string;
}

// User-defined custom metric definition
export interface CustomMetricDef {
  id: string; // unique, e.g. "custom_xxxx"
  label: string;
  icon: string;
  unit: string;
  lowerIsBetter: boolean;
  section: 'physical' | 'ball' | 'other';
  frequency: PerformanceFrequency;
  referenceUrl?: string;
  howToMeasure?: string;
  tags?: string[];
}

// --- Existing types ---
export type LiftingPart = 'インステップ' | 'インサイド' | 'アウトサイド' | 'もも' | '頭' | '胸→足';
export type LiftingSide = '左足' | '右足' | '両足';

export interface LiftingRecord {
  id: string;
  date: string; // yyyy/mm/dd
  count: number;
  location: string;
  part: LiftingPart;
  side: LiftingSide;
}

export interface ImprovementItem {
  text: string;
  done: boolean;
}

export interface PracticeNote {
  id: string;
  date: string; // yyyy/mm/dd
  teamName?: string; // チーム名/スクール名
  location: string;
  category?: string;
  goodPoints: string;
  improvements: ImprovementItem[];
}

export interface BodyRecord {
  id: string;
  date: string; // yyyy/mm/dd
  weight?: number; // kg
  height?: number; // cm
  sleepTime?: string; // HH:MM (例: 22:30)
}

export interface TrainingMenuItem {
  id: string;
  name: string;
  targetCount: number;
  isMinimum: boolean; // true = "以上"
  estimatedMinutes: number;
  order: number;
}

export interface TrainingLog {
  id: string;
  date: string; // yyyy/mm/dd
  completedItemIds: string[];
}

// --- Learning videos (個人ページ /videos) ---
export interface VideoCategory {
  id: string;
  name: string;
  order: number;
  isMatchCategory?: boolean; // true なら SCH の試合動画を自動表示
}

export interface VideoItem {
  id: string;
  categoryId: string;
  url: string;
  description: string;
  order: number;
  createdAt?: string; // ISO datetime - 並び順の基準（未設定時は order で代用）
  pinned?: boolean;
}

export interface VideoViewStat {
  url: string;
  viewCount: number;
  lastViewedDate: string; // yyyy/mm/dd
}

export type MilestoneStatus = 'achieved' | 'challenging' | 'locked';

export interface Milestone {
  target: number;
  status: MilestoneStatus;
}

// SCH チーム共有データ
export interface SchSchedule {
  id: string;
  date: string; // yyyy/mm/dd
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
  location: string;
  note?: string;
}

// Unified event type (replaces SchSchedule + SchMatch)
export type SchEventType = 'practice' | 'match' | 'camp' | 'expedition' | 'other' | 'off';
export type SchMatchType = 'トレマ' | '公式戦' | 'CUP戦' | 'その他';
export type SchMatchFormat = 'tournament' | 'league_tournament' | 'friendly';

export interface SchScorer {
  memberId: string;
  count: number;
}

export interface SchMatch {
  id: string;
  opponentName?: string;
  roundName?: string;       // "予選A" / "第1試合" / "準決勝"
  dayNumber?: number;       // 複数日イベント: 1=1日目, 2=2日目（省略時は1日目扱い）
  isHome?: boolean;
  homeScore?: number;       // SCH側
  awayScore?: number;       // 相手側
  halfTimeHomeScore?: number;
  halfTimeAwayScore?: number;
  hasExtraTime?: boolean;
  extraTimeHomeScore?: number;
  extraTimeAwayScore?: number;
  hasPK?: boolean;
  pkHomeScore?: number;
  pkAwayScore?: number;
  scorers?: SchScorer[];
  assists?: SchScorer[];
  memo?: string;
  videoUrl?: string;        // レガシー（1件のみ）
  videoUrls?: string[];     // BAND / YouTube など（複数）
}

export interface SchStandaloneVideo {
  id: string;
  url: string;
  title?: string;            // タイトル（任意）
  postedAt: string;          // ISO date string
  eventId?: string;          // 紐づけ先イベントID（任意）
  matchId?: string;          // 紐づけ先試合ID（任意）
  thumbnailDataUrl?: string; // ユーザー提供サムネイル（base64）
}

export interface SchEvent {
  id: string;
  date: string;     // yyyy/mm/dd（開始日）
  endDate?: string; // yyyy/mm/dd（終了日・複数日イベントのみ）
  startTime?: string;
  endTime?: string;
  location?: string;
  weatherArea?: string; // 天気取得用の地域名（例：山梨、横浜）
  label?: string; // event name / tournament name
  note?: string;
  type: SchEventType;
  meetingTime?: string;  // 集合時間 HH:MM
  meetingPlace?: string; // 集合場所
  maxParkingSlots?: number; // default 4

  // Match only
  matches?: SchMatch[];     // 複数試合（新形式）。未設定のときは下記レガシーフィールドを参照
  matchType?: SchMatchType;
  matchFormat?: SchMatchFormat;
  roundName?: string;
  opponentName?: string;
  isHome?: boolean;
  homeScore?: number;
  awayScore?: number;
  halfTimeHomeScore?: number;
  halfTimeAwayScore?: number;
  hasExtraTime?: boolean;
  extraTimeHomeScore?: number;
  extraTimeAwayScore?: number;
  hasPK?: boolean;
  pkHomeScore?: number;
  pkAwayScore?: number;
  scorers?: SchScorer[];
  assists?: SchScorer[];
  memo?: string;

  // Camp / expedition only
  mapQuery?: string; // Google Maps embed query

  // Attached images (compressed base64 data URLs)
  images?: string[];
}

export interface SchCheckItem {
  text: string;
  note?: string;
}

export interface SchAnnouncement {
  id: string;
  date: string; // yyyy/mm/dd
  title: string;
  content: string;
  important?: boolean;
  url?: string; // 投稿URL（InstagramなどのSNSリンク）
  linkedEventId?: string; // 予定と連携する場合の予定ID
  checkItems?: SchCheckItem[]; // 持ち物・チェックリスト
  createdAt?: string; // ISO8601 投稿日時（ソート用）
}

export interface SchMemberParent {
  role: '父' | '母' | 'その他';
  name: string;
  nameKana?: string;
}

export interface SchMember {
  id: string;
  number: number;    // jersey number (= parking order)
  name: string;      // 表示名（漢字）
  nameKana?: string; // ふりがな
  birthDate?: string; // 生年月日 YYYY-MM-DD
  parents?: SchMemberParent[];
}

export interface SchParkingSlot {
  memberId: string;
  status: 'pending' | 'used' | 'skipped';
  skipComment?: string;
  isFillIn?: boolean; // true if this person got the spot because someone skipped
}

export interface SchParkingRecord {
  eventId: string;
  eventDate: string;
  eventType: SchEventType | 'schedule'; // 'schedule' is legacy alias for 'practice'
  slots: SchParkingSlot[]; // includes skipped entries + N active slots
  rotationStartIndex: number;
}

export type SchParkingCommentType = 'skip_request' | 'want_slot' | 'order_issue' | 'other';

export interface SchParkingComment {
  id: string;
  createdAt: string; // ISO8601
  memberId: string;
  type: SchParkingCommentType;
  message?: string;
  resolved?: boolean;
}

export interface SchNearbyParking {
  id: string;
  name: string;
  address?: string;
  googleMapsUrl?: string;
  note?: string;
}

// SCH update history
export interface SchUpdateHistory {
  id: string;
  timestamp: string; // ISO
  type: 'announcement' | 'event';
  eventType?: string; // for events: match/practice/camp/expedition/other
  title: string;
  action: 'new' | 'edit' | 'delete';
  changeMemo?: string; // 編集時の変更内容メモ
  itemId: string;
  tab: 'events' | 'announce';
}

// --- Video timestamps（タイムスタンプ記録・振り返り）---
export interface VideoTimestamp {
  id: string;
  videoUrl: string;      // VideoItem.url と一致するキー
  seconds: number;       // 再生位置（Math.floor で整数化）
  label?: string;        // 任意のメモラベル
  viewCount: number;     // このタイムスタンプを何回再生したか
  lastViewedAt?: string; // 最終視聴日 yyyy/mm/dd
  createdAt: string;     // ISO datetime
}

// Admin logs
export interface AccessLogEntry {
  ts: string;   // ISO timestamp
  type: string; // 'family' | 'team' | 'login'
  page: string; // '/sch' | '/family' | 'login'
  ip: string;
  ua: string;
  device_id?: string;
}

export interface ChangeLogEntry {
  ts: string;
  action: string; // 'events' | 'announcements' | 'members' | 'parkingRecords' | 'login' | etc.
  detail: string;
  ip: string;
  ua: string;
  device_id?: string;
}
