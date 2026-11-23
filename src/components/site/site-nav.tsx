"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type NavLink = { href: string; label: string };

function isCurrent(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedOn, setOpenedOn] = useState(pathname);
  const button = useRef<HTMLButtonElement>(null);

  // close the panel after navigating
  if (open && openedOn !== pathname) setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <nav aria-label="Main" className="hidden min-[900px]:block">
        <ul className="flex items-center gap-12">
          {links.map(({ href, label }) => {
            const current = isCurrent(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={current ? "page" : undefined}
                  className={`border-b-2 pt-[6px] pb-1 font-serif text-[17px] text-navy transition-colors duration-150 hover:border-navy/40 ${
                    current ? "border-navy" : "border-transparent"
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => {
          setOpenedOn(pathname);
          setOpen((v) => !v);
        }}
        className="-mr-2 flex items-center gap-2 p-2 text-sm font-semibold tracking-[0.14em] text-navy uppercase min-[900px]:hidden"
      >
        {open ? (
          <X aria-hidden strokeWidth={1.5} className="size-6" />
        ) : (
          <Menu aria-hidden strokeWidth={1.5} className="size-6" />
        )}
        Menu
      </button>

      <nav
        id="site-menu"
        aria-label="Main"
        hidden={!open}
        className="absolute inset-x-0 top-full z-40 border-b border-line bg-white shadow-lg min-[900px]:hidden"
      >
        <ul className="mx-auto flex max-w-[1280px] flex-col px-5 py-3 sm:px-8">
          {links.map(({ href, label }) => {
            const current = isCurrent(pathname, href);
            return (
              <li key={href} className="border-b border-line last:border-0">
                <Link
                  href={href}
                  aria-current={current ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`block py-4 font-serif text-xl text-navy ${current ? "underline decoration-2 underline-offset-8" : ""}`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
