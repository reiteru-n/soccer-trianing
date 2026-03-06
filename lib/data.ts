import { LiftingRecord, PracticeNote } from './types';

export const DATA_VERSION = '2';

export const INITIAL_LIFTING_RECORDS: LiftingRecord[] = [
  { id: '1',  date: '2025/07/23', count: 10,  location: '家',              part: 'インステップ', side: '左足' },
  { id: '2',  date: '2025/07/24', count: 18,  location: '家',              part: 'インステップ', side: '左足' },
  { id: '3',  date: '2025/07/25', count: 22,  location: '家',              part: 'インステップ', side: '左足' },
  { id: '4',  date: '2025/08/28', count: 36,  location: 'リーフスタジアム', part: 'インステップ', side: '左足' },
  { id: '5',  date: '2025/09/24', count: 42,  location: '家',              part: 'インステップ', side: '左足' },
  { id: '6',  date: '2025/09/25', count: 78,  location: '家',              part: 'インステップ', side: '左足' },
  { id: '7',  date: '2025/11/02', count: 83,  location: '大和マリノス',    part: 'インステップ', side: '左足' },
  { id: '8',  date: '2025/12/20', count: 93,  location: '田戸小',          part: 'インステップ', side: '左足' },
  { id: '9',  date: '2025/12/31', count: 114, location: '三春公園',        part: 'インステップ', side: '左足' },
  { id: '10', date: '2026/01/15', count: 135, location: '田戸小',          part: 'インステップ', side: '左足' },
  { id: '11', date: '2026/01/24', count: 201, location: '野比小',          part: 'インステップ', side: '左足' },
  { id: '12', date: '2026/02/19', count: 209, location: 'リーフスタジアム', part: 'インステップ', side: '左足' },
  { id: '13', date: '2026/03/01', count: 312, location: 'JARA',            part: 'インステップ', side: '左足' },
  { id: '14', date: '2026/03/01', count: 24,  location: 'JARA',            part: 'インステップ', side: '右足' },
  { id: '15', date: '2026/03/01', count: 10,  location: '三春公園',        part: 'インサイド',   side: '左足' },
  { id: '16', date: '2026/03/05', count: 11,  location: '家',              part: 'インサイド',   side: '左足' },
  { id: '17', date: '2026/03/05', count: 6,   location: '家',              part: 'インサイド',   side: '右足' },
  { id: '18', date: '2026/03/05', count: 10,  location: '家',              part: 'アウトサイド', side: '左足' },
  { id: '19', date: '2026/03/05', count: 6,   location: '家',              part: 'アウトサイド', side: '右足' },
  { id: '20', date: '2026/03/05', count: 5,   location: '家',              part: 'もも',         side: '左足' },
  { id: '21', date: '2026/03/05', count: 3,   location: '家',              part: 'もも',         side: '右足' },
  { id: '22', date: '2026/03/05', count: 5,   location: '家',              part: 'もも',         side: '両足' },
  { id: '23', date: '2026/03/05', count: 3,   location: '家',              part: 'アウトサイド', side: '両足' },
  { id: '24', date: '2026/03/05', count: 2,   location: '家',              part: '頭',           side: '両足' },
  { id: '25', date: '2026/03/05', count: 8,   location: '家',              part: 'インステップ', side: '両足' },
  { id: '26', date: '2026/03/05', count: 5,   location: '家',              part: 'インサイド',   side: '両足' },
];

export const INITIAL_PRACTICE_NOTES: PracticeNote[] = [
  {
    id: '1',
    date: '2026/01/22',
    location: 'リーフスタジアム',
    goodPoints: 'シュートの足が振り切ることができた。',
    improvements: [{ text: '周りを見ていない', done: false }],
  },
  {
    id: '2',
    date: '2026/01/23',
    location: '家',
    goodPoints: '自分で課題の修正メニューができた。',
    improvements: [{ text: 'シュートの足が降れてなかった。', done: false }],
  },
  {
    id: '3',
    date: '2026/01/24',
    location: '野比小',
    goodPoints: 'カバーができた。',
    improvements: [{ text: '取られたあと取り返すのが遅い', done: false }],
  },
  {
    id: '4',
    date: '2026/01/29',
    location: 'リーフスタジアム',
    goodPoints: 'フェイントでかわした。',
    improvements: [{ text: 'ボールを取りに行くとき焦った。', done: false }],
  },
  {
    id: '5',
    date: '2026/02/22',
    location: 'SCH',
    goodPoints: 'かわしたあとスピードを上げられた。',
    improvements: [{ text: '取られた後にプレーが遅かった。', done: false }],
  },
];

export const MILESTONES = [10, 50, 100, 200, 300, 500, 1000];
