'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRef, useEffect } from 'react';

export default function KanagawaPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'iframeHeight' && iframeRef.current) {
        iframeRef.current.style.height = e.data.height + 'px';
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="min-h-screen bg-white pb-16">

      {/* Header */}
      <div className="relative overflow-hidden bg-[#003087] px-5 pt-8 pb-5">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'repeating-linear-gradient(180deg, transparent, transparent 24px, rgba(255,255,255,0.06) 24px, rgba(255,255,255,0.06) 26px)' }}
        />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0047AB] to-[#001A52] opacity-80" />
        <div className="absolute top-0 right-0 text-white/[0.1] text-[160px] font-black leading-none select-none pointer-events-none translate-x-8 -translate-y-4">↑</div>

        <Link
          href="/sch/history"
          className="relative z-10 flex items-center gap-1.5 text-[#A8C4F0] text-[11px] mb-5 hover:text-white transition-colors"
        >
          ← 先輩たちの戦歴に戻る
        </Link>

        <div className="relative z-10 flex items-end gap-4">
          <Link href="/sch">
            <Image
              src="/sch-logo.png"
              width={175}
              height={215}
              className="object-contain h-16 w-auto drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
              alt="SCH logo"
            />
          </Link>
          <div>
            <p className="text-[#A8C4F0] text-[9px] font-bold tracking-[0.22em] uppercase border border-white/20 bg-white/10 px-2.5 py-0.5 rounded inline-block mb-2">
              KANAGAWA U-12 2010–2025
            </p>
            <h1 className="text-white text-[22px] font-black leading-tight">
              神奈川県チーム<br />
              <span className="text-[#FFD700]">順位推移</span>グラフ
            </h1>
            <p className="text-[#A8C4F0] text-[11px] mt-1.5">
              全日本・日産カップ・FAリーグ・チャンピオンシップ
            </p>
          </div>
        </div>
      </div>

      {/* iframe — 高さはpostMessageで自動調整 */}
      <iframe
        ref={iframeRef}
        src="/kanagawa-animated.html"
        width="100%"
        height="800"
        scrolling="no"
        style={{ border: 'none', display: 'block', overflow: 'hidden' }}
        title="神奈川ジュニアサッカー 順位推移グラフ"
      />

    </div>
  );
}
