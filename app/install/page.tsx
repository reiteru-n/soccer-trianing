import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'インストール手順 — ⚽サッカー記録',
  description: 'Fire TV Stick / Android / iPhone へのインストール手順',
};

export default function InstallPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white">
      <div className="max-w-2xl mx-auto px-5 py-10 space-y-8">
        <header>
          <h1 className="text-3xl font-extrabold">⚽ サッカー記録 インストール</h1>
          <p className="text-sm text-blue-200 mt-2">家族の Fire TV Stick / スマホ / タブレットで使う方法</p>
        </header>

        {/* Fire TV Stick */}
        <section className="bg-white/10 border border-white/20 rounded-2xl p-5 backdrop-blur-sm">
          <h2 className="text-xl font-bold mb-3">📺 Fire TV Stick</h2>

          <div className="bg-red-500/20 border border-red-400/40 rounded-xl p-3 mb-4 text-sm">
            <p className="font-bold text-red-200">⚠️ 対応機種をご確認ください</p>
            <ul className="mt-1.5 text-red-100 space-y-0.5">
              <li>✅ Fire TV Stick <b>4K</b> / <b>4K Max</b> / <b>Cube</b>（Fire OS）</li>
              <li>❌ Fire TV Stick <b>HD (2026)</b> / <b>4K Select</b>（Vega OS = 非対応）</li>
            </ul>
            <p className="mt-2 text-red-100 text-xs">機種確認：設定 &gt; マイFire TV &gt; バージョン情報</p>
          </div>

          <ol className="space-y-3 text-sm text-blue-50 list-decimal pl-5">
            <li>
              <b>「不明なソースからのアプリ」を許可</b><br/>
              設定 &gt; マイFire TV &gt; 開発者オプション &gt;<br/>
              「不明なアプリのインストール」を ON
            </li>
            <li>
              <b>Downloader アプリをインストール</b><br/>
              ホーム画面の検索から「<b>Downloader</b>」を検索 → 入手（無料）
            </li>
            <li>
              <b>Downloader を起動して URL を入力</b><br/>
              <code className="block bg-black/40 rounded px-2 py-1.5 mt-1 text-amber-200 font-mono text-xs break-all">
                soccer-trianing.vercel.app/app.apk
              </code>
              <p className="text-xs text-blue-200 mt-1">
                ※ URL入力がしんどい場合は <a href="https://www.aftvnews.com/code/" className="underline" target="_blank" rel="noopener noreferrer">aftvnews.com/code</a> で 短縮番号を発行できます
              </p>
            </li>
            <li><b>Go</b> を押してダウンロード → <b>インストール</b></li>
            <li>
              インストール完了後、<b>アプリ一覧</b>から「⚽サッカー記録」を起動<br/>
              <span className="text-xs text-blue-200">
                ※ 最初はホーム最上段ではなく「Your Apps &amp; Channels」内に表示されます。<br/>
                よく使う場合はリモコンの三本線（メニュー）ボタンで「ホームに移動」できます。
              </span>
            </li>
          </ol>

          <div className="mt-4 bg-white/5 rounded-xl p-3 text-xs text-blue-200">
            <p className="font-bold text-blue-100 mb-1">🔄 アプリの更新</p>
            <p>中身のページは自動で最新に更新されます（インターネット経由）。<br/>
            アプリ自体のアップデート（リモコン操作の改善など）が出たら、同じ手順で再インストールすればOK。署名は固定なので上書きインストール可能です。</p>
          </div>

          <details className="mt-3 text-xs text-blue-200">
            <summary className="cursor-pointer font-bold text-blue-100">アンインストール手順</summary>
            <p className="mt-2 pl-3">設定 &gt; アプリケーション &gt; インストール済みアプリの管理 &gt; 「⚽サッカー記録」 &gt; アンインストール</p>
          </details>
        </section>

        {/* iPhone */}
        <section className="bg-white/10 border border-white/20 rounded-2xl p-5 backdrop-blur-sm">
          <h2 className="text-xl font-bold mb-3">📱 iPhone / iPad</h2>
          <ol className="space-y-2 text-sm text-blue-50 list-decimal pl-5">
            <li>Safari でこのサイト（<a href="/" className="underline">トップ</a>）を開く</li>
            <li>下部の <b>共有ボタン</b>（□↑）をタップ</li>
            <li>「<b>ホーム画面に追加</b>」をタップ</li>
            <li>名前を確認して「追加」</li>
          </ol>
        </section>

        {/* Android */}
        <section className="bg-white/10 border border-white/20 rounded-2xl p-5 backdrop-blur-sm">
          <h2 className="text-xl font-bold mb-3">🤖 Android スマホ / タブレット</h2>
          <ol className="space-y-2 text-sm text-blue-50 list-decimal pl-5">
            <li>Chrome でこのサイト（<a href="/" className="underline">トップ</a>）を開く</li>
            <li>右上の メニュー（︙）から「<b>アプリをインストール</b>」または「<b>ホーム画面に追加</b>」</li>
            <li>追加されたサッカーボールアイコンをタップして起動</li>
          </ol>
        </section>

        <footer className="text-center text-xs text-blue-300/70 pt-4">
          バージョン: <span suppressHydrationWarning>{process.env.NEXT_PUBLIC_BUILD_TIME}</span>
        </footer>
      </div>
    </div>
  );
}
