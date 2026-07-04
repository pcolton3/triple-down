import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="site-header-safe border-b border-[#173d2a] bg-[#071b12] text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:py-4">
        <Link href="/" className="text-2xl font-black tracking-tight sm:text-3xl">
          Triple Track
        </Link>
        <nav className="flex items-center gap-2 text-sm font-bold text-white/80 sm:gap-4">
          <Link href="/" className="hidden rounded-xl px-3 py-2 hover:bg-white/10 sm:inline-flex">
            Home
          </Link>
          <Link href="/rounds/new" className="rounded-xl bg-white px-3 py-2 text-[#071b12] shadow-sm sm:px-4">
            Start
          </Link>
        </nav>
      </div>
    </header>
  );
}
