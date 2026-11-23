import { cacheLife } from "next/cache";
import Link from "next/link";
import { navLinks, Wordmark } from "./site-header";

async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export async function SiteFooter() {
  const links = [...(await navLinks()), { href: "/privacy", label: "Privacy" }];
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-5">
          <Link href="/" className="self-start">
            <Wordmark />
            <span className="sr-only">, home</span>
          </Link>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {links.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="hover:text-navy hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="text-xs text-muted">
          &copy; <CurrentYear /> Bargain Breaks &middot; Website by Olideen Technologies
        </p>
      </div>
    </footer>
  );
}
