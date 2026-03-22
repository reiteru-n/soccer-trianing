import Link from 'next/link';
import Image from 'next/image';

export default function KanagawaPage() {
  return (
    <div className="min-h-screen bg-[#060810] pb-16">

      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#080c20] to-[#060810] px-5 pt-8 pb-5 border-b border-white/8">
        <div className="absolute inset-0 pointer-events-none bg-radial-[ellipse_60%_120%_at_85%_50%] from-[rgba(245,158,11,0.06)] to-transparent" />

        <Link
          href="/sch/history"
          className="relative z-10 flex items-center gap-1.5 text-[#A8C4F0] text-[11px] mb-5 hover:text-white transition-colors"
        >
          ← 先輩たちの戦歴に戻る
        </Link>

        <div className="relative z-10 flex items-end gap-4">
          <Image
            src="/sch-logo.png"
            width={175}
            height={215}
            className="object-contain h-16 w-auto drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
            alt="SCH logo"
          />
          <div>
            <p className="text-[#f59e0b] text-[9px] font-bold tracking-[0.22em] uppercase border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.08)] px-2.5 py-0.5 rounded inline-block mb-2">
              KANAGAWA U-12 2010–2025
            </p>
            <h1 className="text-white text-[22px] font-black leading-tight">
              神奈川県チーム<br />
              <span className="text-[#f59e0b]">順位推移</span>グラフ
            </h1>
            <p className="text-[#3f4d6b] text-[11px] mt-1.5">
              全日本・日産カップ・FAリーグ・チャンピオンシップ
            </p>
          </div>
        </div>
      </div>

      {/* iframe */}
      <div className="px-0 pt-0">
        <iframe
          src="/kanagawa-animated.html"
          width="100%"
          height="860"
          frameBorder="0"
          scrolling="no"
          style={{ border: 'none', display: 'block' }}
          title="神奈川ジュニアサッカー 順位推移グラフ"
        />
      </div>

    </div>
  );
}
