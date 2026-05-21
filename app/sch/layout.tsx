import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '⚽ サッカー記録',
};

export default function SchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-lg landscape:md:max-w-4xl mx-auto px-4 landscape:md:px-8 pt-4 pb-8 min-h-screen">
      {children}
    </div>
  );
}
