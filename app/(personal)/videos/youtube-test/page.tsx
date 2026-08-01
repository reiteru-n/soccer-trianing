'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const ERROR_MESSAGES: Record<string, string> = {
  no_code: 'Googleからの認可コードを受け取れませんでした',
  env_missing: 'サーバー側の環境変数（GOOGLE_OAUTH_*）が未設定です',
  token_exchange_failed: 'トークン交換に失敗しました',
  no_refresh_token: 'リフレッシュトークンを取得できませんでした（再連携してください）',
  access_denied: '連携が拒否されました',
};

interface CreateResult {
  broadcastId: string;
  watchUrl: string;
  rtmpUrl: string;
  streamKey: string;
}

function CopyField({ label, value, mask }: { label: string; value: string; mask?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(!mask);
  return (
    <div className="bg-slate-900/60 rounded-xl px-3 py-2.5">
      <p className="text-slate-400 text-[11px] mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-white text-xs break-all">
          {shown ? value : '•'.repeat(Math.min(24, value.length))}
        </code>
        {mask && (
          <button
            onClick={() => setShown((v) => !v)}
            className="shrink-0 text-[11px] text-blue-300 px-2 py-1 rounded-lg bg-white/5"
          >
            {shown ? '隠す' : '表示'}
          </button>
        )}
        <button
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 text-[11px] text-white px-2.5 py-1 rounded-lg bg-blue-600"
        >
          {copied ? '✓ コピー済' : 'コピー'}
        </button>
      </div>
    </div>
  );
}

function YoutubeTestInner() {
  const params = useSearchParams();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryError = params.get('error');
  const justConnected = params.get('connected') === '1';

  useEffect(() => {
    fetch('/api/youtube/status')
      .then((r) => r.json())
      .then((d) => setConnected(!!d.connected))
      .catch(() => setConnected(false));
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    setResult(null);
    setStatus(null);
    try {
      const res = await fetch('/api/youtube/live/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '作成に失敗しました');
        return;
      }
      setResult(data);
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setCreating(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!result) return;
    setCheckingStatus(true);
    try {
      const res = await fetch(`/api/youtube/live/status?broadcastId=${result.broadcastId}`);
      const data = await res.json();
      setStatus(data.lifeCycleStatus ?? data.error ?? 'unknown');
    } catch {
      setStatus('確認エラー');
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <Link href="/videos" className="text-blue-300 text-xs">← 学習動画</Link>
      <h1 className="text-xl font-bold mt-3 mb-1">🧪 YouTube配信テスト（個人チャンネル）</h1>
      <p className="text-slate-400 text-xs mb-5">
        技術検証用のページです。使い回せる配信キーを1つ発行し、配信アプリ（Larix Broadcasterなど）に
        一度設定すれば、以後は「配信を作成」を押すだけで新しい配信イベントを作れます。
      </p>

      {(queryError || error) && (
        <div className="bg-red-950/50 border border-red-500/30 rounded-xl px-4 py-3 mb-4 text-red-300 text-sm">
          ⚠️ {ERROR_MESSAGES[queryError ?? ''] ?? error ?? queryError}
        </div>
      )}
      {justConnected && (
        <div className="bg-emerald-950/50 border border-emerald-500/30 rounded-xl px-4 py-3 mb-4 text-emerald-300 text-sm">
          ✅ YouTubeとの連携が完了しました
        </div>
      )}

      {connected === null && <p className="text-slate-400 text-sm">連携状況を確認中...</p>}

      {connected === false && (
        <a
          href="/api/youtube/oauth/start"
          className="block text-center bg-red-600 active:bg-red-500 text-white font-bold py-3 rounded-xl"
        >
          YouTubeと連携する
        </a>
      )}

      {connected === true && (
        <div className="space-y-4">
          <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-emerald-300 text-xs">
            ✅ YouTube連携済み
          </div>

          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full bg-blue-600 active:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl"
          >
            {creating ? '作成中...' : '📡 配信を作成'}
          </button>

          {result && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
              <p className="text-sm font-bold">配信情報</p>
              <CopyField label="RTMP URL（配信サーバー）" value={result.rtmpUrl} />
              <CopyField label="ストリームキー" value={result.streamKey} mask />
              <a
                href={result.watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-blue-300 text-xs underline"
              >
                視聴ページを開く（配信開始まで空白です）
              </a>

              <button
                onClick={handleCheckStatus}
                disabled={checkingStatus}
                className="w-full bg-white/10 active:bg-white/20 text-white text-sm py-2 rounded-lg"
              >
                {checkingStatus ? '確認中...' : '状態を確認'}
              </button>
              {status && (
                <p className="text-center text-xs text-slate-300">
                  現在の状態: <span className="font-bold">{status}</span>
                  {' '}（ready→testing→live→complete と遷移します）
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function YoutubeTestPage() {
  return (
    <Suspense>
      <YoutubeTestInner />
    </Suspense>
  );
}
