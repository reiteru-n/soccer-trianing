'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/',         label: 'ホーム',     icon: '🏠' },
  { href: '/lifting',  label: 'リフティング', icon: '⚽' },
  { href: '/notes',    label: 'ノート',     icon: '📝' },
  { href: '/training', label: '自主練メニュー',     icon: '🏃' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto relative">
        <span className="absolute top-0.5 right-2 text-[9px] text-gray-300 select-none">202603082240</span>
        {navItems.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={"flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors " + (active ? "text-blue-600" : "text-gray-500")}
            >
              <span className="text-xl">{icon}</span>
              <span className={"text-xs font-medium " + (active ? "text-blue-600" : "text-gray-500")}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
