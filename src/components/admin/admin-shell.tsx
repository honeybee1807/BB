"use client";

import {
  BookOpen,
  CalendarDays,
  House,
  Inbox,
  LayoutDashboard,
  Map,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { IdleLogout } from "./idle-logout";
import { SignOutButton } from "./sign-out-button";

type ShellUser = { fullName: string; role: "owner" | "team_member" };

type NavItem = { href: string; label: string; icon: LucideIcon; ownerOnly?: boolean };

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/inquiries", label: "Inquiries", icon: Inbox },
  { href: "/admin/availability", label: "Availability", icon: CalendarDays },
  { href: "/admin/properties", label: "Properties", icon: House },
  { href: "/admin/regions", label: "Regions & estates", icon: Map, ownerOnly: true },
  { href: "/admin/journal", label: "Journal", icon: BookOpen },
  { href: "/admin/team", label: "Team", icon: Users, ownerOnly: true },
  { href: "/admin/settings", label: "Settings", icon: Settings, ownerOnly: true },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((item) => !item.ownerOnly || user.role === "owner");

  return (
    <div className="flex min-h-full flex-1">
      <IdleLogout />
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-navy"
      >
        Skip to content
      </a>

      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between bg-navy px-4 text-white lg:hidden">
        <span className="font-serif text-lg uppercase tracking-display">Bargain Breaks</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="admin-sidebar"
          className="rounded-md p-2 hover:bg-white/10"
        >
          {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-30 bg-navy-deep/40 lg:hidden" aria-hidden onClick={() => setOpen(false)} />
      )}

      <aside
        id="admin-sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-6 py-6">
          <p className="font-serif text-xl uppercase tracking-display">Bargain Breaks</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-white/60">Admin</p>
        </div>
        <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3">
          <ul className="flex flex-col gap-1">
            {items.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-pill px-4 py-2.5 text-sm ${
                      active ? "bg-teal font-medium text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon aria-hidden className="size-4" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-white/10 px-6 py-4 text-sm">
          <p className="font-medium">{user.fullName}</p>
          <p className="text-xs text-white/60">{user.role === "owner" ? "Owner" : "Team member"}</p>
          <div className="mt-3 flex flex-col items-start gap-2">
            <Link
              href="/admin/account"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-2 text-white/80 hover:text-white"
            >
              <ShieldCheck aria-hidden className="size-4" />
              Account security
            </Link>
            <SignOutButton className="text-white/80 underline underline-offset-2 hover:text-white" />
          </div>
        </div>
      </aside>

      <main id="admin-main" tabIndex={-1} className="flex-1 px-4 pb-10 pt-20 lg:px-10 lg:pt-10">
        {children}
      </main>
    </div>
  );
}
