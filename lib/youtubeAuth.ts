// YouTube Data API v3 用の認証・配信キー管理（個人チャンネルでの技術検証用）。
// リフレッシュトークン・使い回し配信キーはUpstash Redisに保存する。

async function getRedis() {
  const { Redis } = await import('@upstash/redis');
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

const REFRESH_TOKEN_KEY = 'youtube:test:refresh_token';
const STREAM_KEY = 'youtube:test:stream';

export async function saveRefreshToken(token: string): Promise<void> {
  const redis = await getRedis();
  await redis.set(REFRESH_TOKEN_KEY, token);
}

export async function hasRefreshToken(): Promise<boolean> {
  const redis = await getRedis();
  const token = await redis.get<string>(REFRESH_TOKEN_KEY);
  return !!token;
}

export async function getAccessToken(): Promise<string> {
  const redis = await getRedis();
  const refreshToken = await redis.get<string>(REFRESH_TOKEN_KEY);
  if (!refreshToken) throw new Error('YouTube未連携です。先に連携してください。');

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET が未設定です');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('アクセストークン取得に失敗しました: ' + (await res.text()));
  const data = await res.json();
  return data.access_token as string;
}

export interface PersistentStream {
  id: string;
  rtmpUrl: string;
  streamKey: string;
}

// 「使い回せる配信キー」を1つだけ作り、以後はRedisにキャッシュしたものを使う。
// これにより配信アプリ側の設定は初回の1回だけで済む。
export async function getOrCreatePersistentStream(accessToken: string): Promise<PersistentStream> {
  const redis = await getRedis();
  const cached = await redis.get<PersistentStream>(STREAM_KEY);
  if (cached) return cached;

  const res = await fetch('https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn,contentDetails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      snippet: { title: 'SCH 配信用キー（使い回し・テスト）' },
      cdn: { frameRate: 'variable', resolution: 'variable', ingestionType: 'rtmp' },
      contentDetails: { isReusable: true },
    }),
  });
  if (!res.ok) throw new Error('配信キー作成に失敗しました: ' + (await res.text()));
  const data = await res.json();
  const stream: PersistentStream = {
    id: data.id,
    rtmpUrl: data.cdn.ingestionInfo.ingestionAddress,
    streamKey: data.cdn.ingestionInfo.streamName,
  };
  await redis.set(STREAM_KEY, stream);
  return stream;
}
