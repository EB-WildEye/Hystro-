import Link from "next/link";

type NavItem = { href: string; label: string };

export function Header({ title, nav, userName }: { title: string; nav: NavItem[]; userName?: string }) {
  return (
    <header className="no-print border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="font-bold">{title}</span>
        <nav className="flex flex-wrap gap-4 text-sm">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="text-muted hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-3 text-sm">
          {userName && <span className="text-muted">{userName}</span>}
          <form action="/auth/signout" method="post">
            <button type="submit" className="rounded-md border border-line px-3 py-1 hover:bg-bg">
              יציאה
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
