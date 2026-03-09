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
