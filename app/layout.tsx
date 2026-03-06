import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProvider } from '@/lib/context';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
  title: '⚽ 拓渡のサッカー記録',
  description: '拓渡くんのサッカー成長記録サイト',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;500;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-slate-50 min-h-screen">
        <AppProvider>
          <main className="max-w-lg mx-auto px-4 pt-4 pb-24 min-h-screen">
            {children}
          </main>
          <BottomNav />
        </AppProvider>
      </body>
    </html>
  );
}
