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
export type SchEventType = 'practice' | 'match' | 'camp' | 'expedition' | 'other';
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
  videoUrl?: string;        // BAND / YouTube など
}

export interface SchEvent {
  id: string;
  date: string;     // yyyy/mm/dd（開始日）
  endDate?: string; // yyyy/mm/dd（終了日・複数日イベントのみ）
  startTime?: string;
  endTime?: string;
  location?: string;
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

export interface SchNearbyParking {
  id: string;
  name: string;
  address?: string;
  googleMapsUrl?: string;
  note?: string;
}

// Admin logs
export interface AccessLogEntry {
  ts: string;   // ISO timestamp
  type: string; // 'family' | 'team' | 'login'
  page: string; // '/sch' | '/family' | 'login'
  ip: string;
  ua: string;
}

export interface ChangeLogEntry {
  ts: string;
  action: string; // 'events' | 'announcements' | 'members' | 'parkingRecords' | 'login' | etc.
  detail: string;
  ip: string;
  ua: string;
}
