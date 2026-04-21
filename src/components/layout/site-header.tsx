import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-3xl font-bold text-[#2f8df3]">
          Triple Down
        </Link>
        <nav className="hidden gap-8 text-sm font-medium text-slate-700 md:flex">
          <Link href="/">Home</Link>
          <Link href="/rounds/new">Start Round</Link>
        </nav>
      </div>
    </header>
  );
}
