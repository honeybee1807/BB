import Image from "next/image";
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

export function Wordmark() {
  return (
    <span className="font-serif text-[21px] leading-none font-bold tracking-[0.12em] text-navy uppercase sm:text-2xl">
      Bargain Breaks
    </span>
  );
}

export async function SiteHeader() {
  const links = await navLinks();
  return (
    <header className="relative border-b border-line bg-white">
      <div className="mx-auto flex h-[84px] max-w-[1280px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="shrink-0">
          <Image
            src="/images/logo.webp"
            alt="Bargain Breaks, home"
            width={760}
            height={382}
            preload
            sizes="160px"
            className="h-[60px] w-auto sm:h-[68px]"
          />
        </Link>
        <SiteNav links={links} />
      </div>
    </header>
  );
}
