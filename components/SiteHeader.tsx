import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

export default function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800/80">
      <Link
        href="/"
        className="text-lg font-bold tracking-tight text-slate-900 hover:text-slate-700 dark:text-white dark:hover:text-slate-200"
      >
        Can He Shoot?
      </Link>
      <div className="flex items-center gap-1 sm:gap-2">
        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white"
          >
            Ask a question
          </Link>
          <Link
            href="/stats"
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white"
          >
            Browse Players
          </Link>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
