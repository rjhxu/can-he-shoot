'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';

const NAV_ITEMS = [
  { href: '/', label: 'Ask' },
  { href: '/stats', label: 'Players' },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <BallMark />
          <span className="whitespace-nowrap font-display text-lg font-bold uppercase tracking-wide text-ink transition group-hover:text-accent sm:text-2xl">
            Can He Shoot?
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-3">
          <nav className="flex items-center gap-1 rounded-full border border-line bg-panel p-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition sm:px-4 ${
                    active
                      ? 'bg-ink text-paper shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function BallMark() {
  return (
    <svg
      width={26}
      height={26}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className="shrink-0 text-accent"
      aria-hidden
    >
      <circle cx={12} cy={12} r={10} />
      <path d="M2 12h20" />
      <path d="M12 2c-3 2.6-4.8 6.1-4.8 10S9 19.4 12 22" />
      <path d="M12 2c3 2.6 4.8 6.1 4.8 10S15 19.4 12 22" />
    </svg>
  );
}
