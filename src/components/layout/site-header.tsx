import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="border-b border-[#173d2a] bg-[#071b12] text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-3xl font-black tracking-tight">
          Triple Track
        </Link>
        <nav className="hidden gap-8 text-sm font-bold text-white/80 md:flex">
          <Link href="/">Home</Link>
          <Link href="/rounds/new">Start Round</Link>
        </nav>
      </div>
    </header>
  );
}
