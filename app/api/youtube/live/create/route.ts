import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, getOrCreatePersistentStream } from '@/lib/youtubeAuth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const title: string | undefined = body.title;

    const accessToken = await getAccessToken();
    const stream = await getOrCreatePersistentStream(accessToken);

    const broadcastRes = await fetch(
      'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snippet: {
            title: title || `テスト配信 ${new Date().toLocaleString('ja-JP')}`,
            scheduledStartTime: new Date().toISOString(),
          },
          status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false },
          // RTMPの受信開始/終了を検知して自動でLive化・終了させる
          contentDetails: { enableAutoStart: true, enableAutoStop: true },
        }),
      },
    );
    if (!broadcastRes.ok) {
      return NextResponse.json(
        { error: '配信イベント作成に失敗しました', detail: await broadcastRes.text() },
        { status: 500 },
      );
    }
    const broadcast = await broadcastRes.json();

    const bindRes = await fetch(
      `https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${broadcast.id}&part=id,contentDetails&streamId=${stream.id}`,
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!bindRes.ok) {
      return NextResponse.json(
        { error: '配信キーの紐付けに失敗しました', detail: await bindRes.text() },
        { status: 500 },
      );
    }

    return NextResponse.json({
      broadcastId: broadcast.id,
      watchUrl: `https://youtube.com/watch?v=${broadcast.id}`,
      rtmpUrl: stream.rtmpUrl,
      streamKey: stream.streamKey,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '不明なエラー' }, { status: 500 });
  }
}
