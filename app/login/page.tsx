'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// 遷移先は入力されたパスワードの種類（家族／チーム）でサーバー側が判定して返す。
// 未ログイン状態のこの画面では、個人ページ・チームページどちらが存在するかを
// 一切示さない（タイトル・アイコンは常に共通のもの）。
function safeRedirect(kind: 'family' | 'team', redirectParam: string | null): string {
  if (kind === 'family') {
    // 家族パスワードは上位互換のため、どのページへのリダイレクト要求でもそのまま許可する
    return redirectParam || '/';
  }
  // チームパスワードは /sch 配下（/sch/admin を除く）にしかアクセスできないため、
  // それ以外の遷移先が指定されていた場合はチームトップへフォールバックする
  if (redirectParam && redirectParam.startsWith('/sch') && !redirectParam.startsWith('/sch/admin')) {
    return redirectParam;
  }
  return '/sch';
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectParam = params.get('redirect');

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(safeRedirect(data.kind, redirectParam));
      } else {
        setError(data.error ?? 'ログインに失敗しました');
      }
    } catch {
      setError('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 50%, #0a1f3e 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-5xl mb-3">⚽</p>
          <h1 className="text-2xl font-extrabold text-white">
            ログイン
          </h1>
          <p className="text-sm text-blue-300 mt-1">
            パスワードを入力してください
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800/80 rounded-2xl p-6 border border-white/10 shadow-2xl space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              🔑 パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
              className="w-full rounded-xl border-2 border-slate-600 bg-slate-900/50 text-white px-4 py-3 text-base focus:border-blue-400 focus:outline-none placeholder-slate-500"
              placeholder="パスワードを入力"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-base transition-all active:scale-95"
          >
            {loading ? '確認中...' : 'ログイン'}
          </button>
        </form>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
