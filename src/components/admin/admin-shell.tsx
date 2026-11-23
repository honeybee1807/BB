"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  House,
  Inbox,
  LayoutDashboard,
  LogOut,
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
import { signOut } from "./sign-out-button";

type ShellUser = { fullName: string; role: "owner" | "team_member" };

type NavItem = { href: string; label: string; icon: LucideIcon; ownerOnly?: boolean };

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/inquiries", label: "Inquiries", icon: Inbox },
  { href: "/admin/availability", label: "Availability", icon: CalendarDays },
  { href: "/admin/properties", label: "Properties", icon: House },
  { href: "/admin/journal", label: "Journal", icon: BookOpen },
  { href: "/admin/regions", label: "Regions & estates", icon: Map, ownerOnly: true },
  { href: "/admin/team", label: "Team", icon: Users, ownerOnly: true },
  { href: "/admin/settings", label: "Settings", icon: Settings, ownerOnly: true },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <House aria-hidden strokeWidth={1.5} className="size-7 shrink-0 text-white/90" />
      <p className="font-serif text-lg leading-tight font-semibold tracking-[0.12em] text-white uppercase">
        Bargain
        <br />
        Breaks
      </p>
    </div>
  );
}

function UserMenu({ user, onNavigate }: { user: ShellUser; onNavigate: () => void }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex w-full items-center gap-3 rounded-lg bg-white/5 p-3 text-left hover:bg-white/10">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sand text-sm font-semibold text-navy"
        >
          {initials(user.fullName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">{user.fullName}</span>
          <span className="block text-xs text-white/70">{user.role === "owner" ? "Owner" : "Team member"}</span>
        </span>
        <ChevronDown aria-hidden strokeWidth={1.5} className="size-4 text-white/70" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="start"
          sideOffset={8}
          className="z-50 min-w-52 rounded-lg bg-white p-1 text-sm text-ink shadow-lg ring-1 ring-line"
        >
          <DropdownMenu.Item asChild>
            <Link
              href="/admin/account"
              onClick={onNavigate}
              className="flex items-center gap-2 rounded-md px-3 py-2 outline-none data-highlighted:bg-admin-bg"
            >
              <ShieldCheck aria-hidden strokeWidth={1.5} className="size-4 text-muted" />
              Account security
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => void signOut("user")}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-highlighted:bg-admin-bg"
          >
            <LogOut aria-hidden strokeWidth={1.5} className="size-4 text-muted" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function SidebarBody({ user, onNavigate }: { user: ShellUser; onNavigate: () => void }) {
  const pathname = usePathname();
  const items = NAV.filter((item) => !item.ownerOnly || user.role === "owner");
  return (
    <>
      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3">
        <ul className="flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  className={`flex h-11 items-center gap-3 rounded-lg px-4 text-sm transition-colors duration-150 ${
                    active ? "bg-teal font-medium text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon aria-hidden strokeWidth={1.5} className="size-[18px]" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-3">
        <UserMenu user={user} onNavigate={onNavigate} />
      </div>
    </>
  );
}

export function AdminShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="flex min-h-full flex-1">
      <IdleLogout />
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-navy"
      >
        Skip to content
      </a>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <div className="on-dark fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between bg-navy-deep px-4 lg:hidden">
          <Brand />
          <Dialog.Trigger className="rounded-lg p-2 text-white hover:bg-white/10">
            <Menu aria-hidden strokeWidth={1.5} className="size-6" />
            <span className="sr-only">Open menu</span>
          </Dialog.Trigger>
        </div>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-navy-deep/50 lg:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            className="on-dark fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-navy-deep text-white lg:hidden"
          >
            <div className="flex items-center justify-between px-5 py-5">
              <Dialog.Title asChild>
                <div>
                  <Brand />
                  <span className="sr-only">Admin menu</span>
                </div>
              </Dialog.Title>
              <Dialog.Close className="rounded-lg p-2 hover:bg-white/10">
                <X aria-hidden strokeWidth={1.5} className="size-6" />
                <span className="sr-only">Close menu</span>
              </Dialog.Close>
            </div>
            <SidebarBody user={user} onNavigate={close} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <aside className="on-dark sticky top-0 hidden h-screen w-[max(220px,15vw)] max-w-64 shrink-0 flex-col bg-navy-deep text-white lg:flex">
        <div className="px-6 pt-7 pb-8">
          <Brand />
        </div>
        <SidebarBody user={user} onNavigate={close} />
      </aside>

      <main id="admin-main" tabIndex={-1} className="min-w-0 flex-1 px-4 pt-20 pb-10 sm:px-6 lg:px-8 lg:pt-7">
        {children}
      </main>
    </div>
  );
}
