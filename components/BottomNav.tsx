'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/',         label: 'ホーム',       icon: '🏠' },
  { href: '/lifting',  label: 'リフティング',  icon: '⚽' },
  { href: '/notes',    label: 'ノート',        icon: '📝' },
  { href: '/training', label: '自主練メニュー', icon: '🏃' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-white/10 shadow-2xl shadow-black/50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto relative">
        <span className="absolute top-0.5 right-2 text-[9px] text-white/20 select-none">{process.env.NEXT_PUBLIC_BUILD_TIME}</span>
        {navItems.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={"flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all " + (active ? "text-blue-400" : "text-slate-500")}
            >
              <span className={"text-xl transition-transform " + (active ? "scale-110" : "")}>{icon}</span>
              <span className={"text-xs font-medium " + (active ? "text-blue-400" : "text-slate-500")}>
                {label}
              </span>
              {active && <span className="absolute bottom-1 w-8 h-0.5 bg-blue-400 rounded-full" />}
            </Link>
          );
        })}
        <Link
          href="/sch"
          className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all"
        >
          <Image
            src="/sch-logo.png"
            alt="SCH"
            width={175}
            height={215}
            className={"object-contain transition-transform " + (pathname === '/sch' ? "scale-110 h-8 w-auto" : "opacity-60 h-8 w-auto")}
          />
          <span className={"text-xs font-medium " + (pathname === '/sch' ? "text-blue-400" : "text-slate-500")}>
            SCHチーム
          </span>
          {pathname === '/sch' && <span className="absolute bottom-1 w-8 h-0.5 bg-blue-400 rounded-full" />}
        </Link>
      </div>
    </nav>
  );
}
