import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SCH Info',
  openGraph: {
    title: 'SCH Info',
    description: 'SCH FC 保護者向け情報サイト',
    images: [{ url: 'https://soccer-trianing.vercel.app/sch-logo.png', width: 175, height: 215 }],
    url: 'https://soccer-trianing.vercel.app/sch',
  },
};

export default function SchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-lg landscape:md:max-w-4xl mx-auto px-4 landscape:md:px-8 pt-4 pb-8 min-h-screen bg-gradient-to-b from-slate-950 via-sky-950/20 to-slate-950">
      {children}
    </div>
  );
}
