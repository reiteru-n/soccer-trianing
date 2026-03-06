export type LiftingPart = 'インステップ' | 'インサイド' | 'アウトサイド' | 'もも' | '頭';
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
  location: string;
  goodPoints: string;
  improvements: ImprovementItem[];
}

export type MilestoneStatus = 'achieved' | 'challenging' | 'locked';

export interface Milestone {
  target: number;
  status: MilestoneStatus;
}
