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

export interface SchMatch {
  id: string;
  date: string; // yyyy/mm/dd
  startTime?: string; // HH:MM
  opponent?: string;
  location?: string;
  homeScore?: number;
  awayScore?: number;
  isHome?: boolean;
  note?: string;
}

export interface SchAnnouncement {
  id: string;
  date: string; // yyyy/mm/dd
  title: string;
  content: string;
  important?: boolean;
}

export interface SchMember {
  id: string;
  number: number; // jersey number (= parking order)
  name: string;   // hiragana name
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
  eventType: 'schedule' | 'match';
  slots: SchParkingSlot[]; // includes skipped entries + 4 active slots
  rotationStartIndex: number;
}

export interface SchNearbyParking {
  id: string;
  name: string;
  address?: string;
  googleMapsUrl?: string;
  note?: string;
}
