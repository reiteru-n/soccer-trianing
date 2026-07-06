import { NextResponse } from 'next/server';

// 音声入力: ブラウザ(MediaRecorder)から受け取った生音声を、自宅PCのWhisperデーモンへ
// Tailscale Funnel経由で中継する。PCがオフライン/Tailscale未接続のときは
// daemon_unreachable を返し、クライアント側でポップアップ表示する。
// 外部脳 Knowledge/tech/voice-input-recipe.md のアーキテクチャに準拠。

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const daemonUrl = process.env.WHISPER_DAEMON_URL;
  if (!daemonUrl) {
    return NextResponse.json({ error: 'daemon_unreachable', message: 'WHISPER_DAEMON_URL is not configured' }, { status: 503 });
  }

  const contentType = req.headers.get('content-type') || 'application/octet-stream';
  const audio = await req.arrayBuffer();
  if (audio.byteLength === 0) {
    return NextResponse.json({ error: 'empty_audio' }, { status: 400 });
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': contentType };
    if (process.env.WHISPER_DAEMON_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.WHISPER_DAEMON_TOKEN}`;
    }
    const upstream = await fetch(`${daemonUrl.replace(/\/$/, '')}/transcribe?lang=ja`, {
      method: 'POST',
      headers,
      body: audio,
      signal: AbortSignal.timeout(25000),
    });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'daemon_unreachable', status: upstream.status }, { status: 502 });
    }
    // デーモンが返すNDJSON（start/progress/done/error）をそのままクライアントへ中継する
    return new NextResponse(upstream.body, {
      headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache' },
    });
  } catch (err) {
    console.error('[transcribe] daemon unreachable', err);
    return NextResponse.json({ error: 'daemon_unreachable' }, { status: 503 });
  }
}
