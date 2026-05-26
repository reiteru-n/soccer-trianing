'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { HouseIcon, BallIcon, NoteIcon, RunnerIcon, ChartIcon } from './AppIcons';

const navItems = [
  { href: '/',         label: 'ホーム',          Icon: HouseIcon },
  { href: '/lifting',  label: 'リフティング',     Icon: BallIcon },
  { href: '/notes',    label: 'ノート',           Icon: NoteIcon },
  { href: '/training', label: '自主練\nメニュー', Icon: RunnerIcon },
  { href: '/growth',   label: '成長記録',         Icon: ChartIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-xl border-t border-white/10 shadow-2xl shadow-black/50">
      <div className="flex justify-around items-center h-16 max-w-lg landscape:md:max-w-4xl mx-auto relative">
        <span className="absolute top-0.5 left-2 text-[9px] text-white/20 select-none">{process.env.NEXT_PUBLIC_BUILD_TIME}</span>

        {navItems.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={
                'flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all ' +
                (active ? 'text-sky-400' : 'text-slate-500')
              }
            >
              <Icon
                size={22}
                className={'transition-transform ' + (active ? 'scale-110' : '')}
              />
              {label.includes('\n') ? (
                <span className={'font-medium text-center leading-tight ' + (active ? 'text-sky-400' : 'text-slate-500')}>
                  <span className="block text-[9px]">{label.split('\n')[0]}</span>
                  <span className="block text-xs whitespace-nowrap">{label.split('\n')[1]}</span>
                </span>
              ) : (
                <span className={'text-[9px] font-medium ' + (active ? 'text-sky-400' : 'text-slate-500')}>
                  {label}
                </span>
              )}
              {active && (
                <span className="absolute bottom-1 w-8 h-0.5 rounded-full bg-gradient-to-r from-sky-400 to-cyan-400" />
              )}
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
            className={
              'object-contain transition-transform ' +
              (pathname === '/sch' ? 'scale-110 h-8 w-auto' : 'opacity-60 h-8 w-auto')
            }
          />
          <span className={'text-[9px] font-medium ' + (pathname === '/sch' ? 'text-sky-400' : 'text-slate-500')}>
            SCHチーム
          </span>
          {pathname === '/sch' && (
            <span className="absolute bottom-1 w-8 h-0.5 rounded-full bg-gradient-to-r from-sky-400 to-cyan-400" />
          )}
        </Link>
      </div>
    </nav>
  );
}
