import Link from 'next/link';
import { CURRENT_SEASON } from '@/lib/nba/season';

export default function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-ink-faint sm:flex-row sm:px-6">
        <div>
          <span className="font-display text-base font-bold uppercase tracking-wide text-ink-muted">
            Can He Shoot?
          </span>
          <span className="ml-2">· {CURRENT_SEASON} NBA season</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/" className="transition hover:text-ink">
            Ask a question
          </Link>
          <Link href="/stats" className="transition hover:text-ink">
            Browse players
          </Link>
        </nav>
      </div>
    </footer>
  );
}
