import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const MEMBERS = [
  { id: 'm6',  number: 6,  name: '年森海志',   nameKana: 'かいし',     parents: [{ role: '父', name: '年森祥太郎' }, { role: '母', name: '年森舞' }] },
  { id: 'm7',  number: 7,  name: '廣瀧樹',     nameKana: 'いつき',     parents: [{ role: '父', name: '廣瀧巧' }, { role: '母', name: '廣瀧渚' }] },
  { id: 'm8',  number: 8,  name: '大和田琉煌', nameKana: 'るきあ',     parents: [{ role: '父', name: '大和田真' }, { role: '母', name: '大和田あゆ未' }] },
  { id: 'm9',  number: 9,  name: '荒井修蔵',   nameKana: 'しゅうぞう', parents: [{ role: '父', name: '荒井大輔' }, { role: '母', name: '荒井未紗子' }] },
  { id: 'm10', number: 10, name: '嶋津然',     nameKana: 'ぜん',       parents: [{ role: '父', name: '嶋津勝也' }, { role: '母', name: '嶋津佳奈' }] },
  { id: 'm11', number: 11, name: '小野沢朔',   nameKana: 'さく',       parents: [{ role: '父', name: '小野沢太郎' }, { role: '母', name: '小野沢友香里' }] },
  { id: 'm14', number: 14, name: '鳥谷海翔',   nameKana: 'かいと',     parents: [{ role: '父', name: '鳥谷浩之' }, { role: '母', name: '鳥谷香織' }] },
  { id: 'm15', number: 15, name: '小笠原快',   nameKana: 'かい',       parents: [{ role: '父', name: '小笠原亮' }, { role: '母', name: '小笠原晴菜' }] },
  { id: 'm17', number: 17, name: '村岡晟旺',   nameKana: 'せお',       parents: [{ role: '母', name: '村岡祥子' }, { role: '父', name: '村岡慶男' }] },
  { id: 'm19', number: 19, name: '西本拓渡',   nameKana: 'たくと',     birthDate: '2019-12-19', parents: [{ role: '父', name: '西本励照' }, { role: '母', name: '西本倫実' }] },
  { id: 'm20', number: 20, name: '宮﨑朔太郎', nameKana: 'さくたろう', parents: [{ role: '父', name: '竜史郎' }, { role: '母', name: '有子' }] },
  { id: 'm30', number: 30, name: '横山寛人',   nameKana: 'ひろと',     parents: [{ role: '父', name: '横山大輔' }, { role: '母', name: '横山えつこ' }] },
  { id: 'm31', number: 31, name: '鈴木柊羽',   nameKana: 'しゅう',     parents: [{ role: '母', name: 'しおり' }] },
];

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  await redis.set('sch:members', MEMBERS);
  return NextResponse.json({ ok: true, count: MEMBERS.length });
}
