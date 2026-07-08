'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ReloadIcon } from '@/components/AppIcons';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5分おきポーリング

/**
 * PWA(ホーム画面追加)は再タップしても裏のプロセスがそのまま再開されるだけで
 * 新しいビルドを取得しに行かない。フォアグラウンド復帰時とポーリングで新ビルドを検知し、
 * バナーでユーザーに更新を促す（外部脳 Design/app.md「iOS ホーム画面PWA(standalone)の更新検知」準拠）。
 * 検知にはVercelがデプロイごとに自動設定するVERCEL_GIT_COMMIT_SHAを使う（/api/build-info経由）。
 */
export default function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateNote, setUpdateNote] = useState('');
  const currentCommitRef = useRef<string | null>(null);
  const updateAvailableRef = useRef(false);
  updateAvailableRef.current = updateAvailable;

  useEffect(() => {
    fetch('/api/build-info', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => { currentCommitRef.current = data.commit ?? null; })
      .catch(() => { /* 取得失敗時は次回以降の比較をスキップ */ });
  }, []);

  const checkForUpdate = useCallback(async () => {
    if (updateAvailableRef.current || !currentCommitRef.current) return;
    try {
      const res = await fetch('/api/build-info', { cache: 'no-store' });
      const data = await res.json();
      if (data.commit && data.commit !== currentCommitRef.current) {
        setUpdateAvailable(true);
        try {
          const noteRes = await fetch('/update-note.txt', { cache: 'no-store' });
          if (noteRes.ok) setUpdateNote((await noteRes.text()).trim());
        } catch {
          // 取得失敗はサイレントに無視（バナー自体は表示を継続）
        }
      }
    } catch {
      // オフライン等はサイレントに無視
    }
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    const interval = setInterval(checkForUpdate, CHECK_INTERVAL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
    };
  }, [checkForUpdate]);

  if (!updateAvailable) return null;

  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      title={updateNote || undefined}
      className="fixed top-0 inset-x-0 z-[300] w-full flex items-center justify-center gap-1.5 bg-sky-500 active:bg-sky-400 text-white text-xs font-bold py-2 shadow-lg"
    >
      <ReloadIcon size={14} />
      新しいバージョンがあります。タップして更新
    </button>
  );
}
