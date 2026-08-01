import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/youtubeAuth';

export async function GET(req: NextRequest) {
  const broadcastId = req.nextUrl.searchParams.get('broadcastId');
  if (!broadcastId) {
    return NextResponse.json({ error: 'broadcastId is required' }, { status: 400 });
  }
  try {
    const accessToken = await getAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/liveBroadcasts?part=status&id=${broadcastId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      return NextResponse.json({ error: await res.text() }, { status: 500 });
    }
    const data = await res.json();
    const item = data.items?.[0];
    return NextResponse.json({ lifeCycleStatus: item?.status?.lifeCycleStatus ?? 'unknown' });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '不明なエラー' }, { status: 500 });
  }
}
