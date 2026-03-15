import { AppProvider } from '@/lib/context';
import BottomNav from '@/components/BottomNav';

export default function PersonalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <main className="max-w-lg mx-auto px-4 pt-4 pb-24 min-h-screen">
        {children}
      </main>
      <BottomNav />
    </AppProvider>
  );
}
