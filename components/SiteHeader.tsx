import Link from 'next/link';

export default function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
      <Link href="/" className="text-lg font-bold tracking-tight text-white hover:text-slate-200">
        Can he shoot?
      </Link>
      <nav>
        <Link
          href="/players"
          className="rounded-lg px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800/60 hover:text-white"
        >
          Browse Players
        </Link>
      </nav>
    </header>
  );
}
