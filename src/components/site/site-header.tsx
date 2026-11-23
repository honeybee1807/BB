import Link from "next/link";
import { listPosts } from "@/lib/data/public";
import { SiteNav, type NavLink } from "./site-nav";

export async function navLinks(): Promise<NavLink[]> {
  const posts = await listPosts();
  return [
    { href: "/", label: "Home" },
    { href: "/properties", label: "Properties" },
    { href: "/about", label: "About" },
    ...(posts.length > 0 ? [{ href: "/journal", label: "Journal" }] : []),
    { href: "/contact", label: "Contact" },
  ];
}

export function Wordmark({ withTagline = false }: { withTagline?: boolean }) {
  return (
    <span className="flex flex-col">
      <span className="font-serif text-[21px] leading-none font-bold tracking-[0.12em] text-navy uppercase sm:text-2xl">
        Bargain Breaks
      </span>
      {withTagline && (
        <span className="mt-2 text-[10px] leading-none tracking-wide-plus text-muted uppercase">
          Curated holiday stays
        </span>
      )}
    </span>
  );
}

export async function SiteHeader() {
  const links = await navLinks();
  return (
    <header className="relative border-b border-line bg-white">
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="-my-2 py-2">
          <Wordmark withTagline />
          <span className="sr-only">, home</span>
        </Link>
        <SiteNav links={links} />
      </div>
    </header>
  );
}
