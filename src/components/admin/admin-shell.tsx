"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  CalendarDays,
  ChevronDown,
  FileText,
  Headset,
  House,
  LayoutGrid,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { initials } from "@/lib/admin-format";
import { supportHref } from "@/lib/site";
import { IdleLogout } from "./idle-logout";
import { signOut } from "./sign-out-button";

type ShellUser = { fullName: string; role: "owner" | "team_member" };

type NavItem = { href: string; label: string; icon: LucideIcon; ownerOnly?: boolean; also?: string[] };

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutGrid },
  { href: "/admin/properties", label: "Properties", icon: House, also: ["/admin/regions"] },
  { href: "/admin/availability", label: "Availability", icon: CalendarDays },
  { href: "/admin/inquiries", label: "Inquiries", icon: MessageCircle },
  { href: "/admin/journal", label: "Journal", icon: FileText, also: ["/admin/testimonials"] },
  { href: "/admin/team", label: "Team & settings", icon: Settings, ownerOnly: true, also: ["/admin/settings"] },
];

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/admin") return pathname === "/admin";
  return [item.href, ...(item.also ?? [])].some((href) => under(pathname, href));
}

function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl bg-white p-3 ${className}`}>
      <Image
        src="/images/logo.webp"
        alt="Bargain Breaks"
        width={760}
        height={382}
        sizes="240px"
        className="h-auto w-full"
      />
    </div>
  );
}

function UserMenu({ user, onNavigate }: { user: ShellUser; onNavigate: () => void }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/5">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-side-active font-serif text-lg text-white"
        >
          {initials(user.fullName).slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{user.fullName}</span>
          <span className="block text-xs text-side-label">{user.role === "owner" ? "Owner" : "Team member"}</span>
        </span>
        <ChevronDown aria-hidden strokeWidth={1.5} className="size-4 text-side-label" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="start"
          sideOffset={8}
          className="admin-theme z-50 min-w-52 rounded-xl bg-white p-1 text-sm text-ink shadow-lg ring-1 ring-line"
        >
          <DropdownMenu.Item asChild>
            <Link
              href="/admin/account"
              onClick={onNavigate}
              className="flex items-center gap-2 rounded-lg px-3 py-2 outline-none data-highlighted:bg-admin-bg"
            >
              <ShieldCheck aria-hidden strokeWidth={1.5} className="size-4 text-muted" />
              Account security
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => void signOut("user")}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 outline-none data-highlighted:bg-admin-bg"
          >
            <LogOut aria-hidden strokeWidth={1.5} className="size-4 text-muted" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function SupportLink() {
  const href = supportHref();
  if (!href) return null;
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-side-text hover:bg-white/5 hover:text-white"
    >
      <Headset aria-hidden strokeWidth={1.5} className="size-5 shrink-0" />
      <span>
        <span className="block text-sm font-medium">Need help?</span>
        <span className="block text-xs text-side-label">Contact support</span>
      </span>
    </a>
  );
}

function SidebarBody({ user, newCount, onNavigate }: { user: ShellUser; newCount: number; onNavigate: () => void }) {
  const pathname = usePathname();
  const items = NAV.filter((item) => !item.ownerOnly || user.role === "owner");
  return (
    <>
      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-4">
        <p className="mb-3 px-4 text-[11px] font-semibold tracking-[0.18em] text-side-label uppercase">Workspace</p>
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            const badge = item.href === "/admin/inquiries" && newCount > 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  className={`flex h-12 items-center gap-3.5 rounded-xl px-4 text-[15px] transition-colors duration-150 ${
                    active
                      ? "bg-side-active font-semibold text-white"
                      : "text-side-text hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon aria-hidden strokeWidth={1.6} className="size-5 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {badge && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-navy">
                      {newCount > 99 ? "99+" : newCount}
                      <span className="sr-only"> new</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mx-4 flex flex-col gap-2 border-t border-white/10 py-4">
        <SupportLink />
        <UserMenu user={user} onNavigate={onNavigate} />
      </div>
    </>
  );
}

export function AdminShell({
  user,
  newCount,
  children,
}: {
  user: ShellUser;
  newCount: number;
  children: React.ReactNode;
}) {
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
          <p className="font-serif text-lg tracking-[0.08em] text-white">Bargain Breaks</p>
          <Dialog.Trigger className="rounded-lg p-2 text-white hover:bg-white/10">
            <Menu aria-hidden strokeWidth={1.5} className="size-6" />
            <span className="sr-only">Open menu</span>
          </Dialog.Trigger>
        </div>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-navy-deep/50 lg:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            className="admin-theme on-dark fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col bg-navy-deep text-white lg:hidden"
          >
            <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-8">
              <Dialog.Title asChild>
                <div className="w-48">
                  <Logo />
                  <span className="sr-only">Admin menu</span>
                </div>
              </Dialog.Title>
              <Dialog.Close className="rounded-lg p-2 hover:bg-white/10">
                <X aria-hidden strokeWidth={1.5} className="size-6" />
                <span className="sr-only">Close menu</span>
              </Dialog.Close>
            </div>
            <SidebarBody user={user} newCount={newCount} onNavigate={close} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* the column fills the page height; the menu inside it stays in view while scrolling */}
      <div className="hidden w-72 shrink-0 bg-navy-deep lg:block xl:w-80">
        <aside className="on-dark sticky top-0 flex h-screen flex-col text-white">
          <div className="px-8 pt-8 pb-10">
            <Logo className="max-w-60" />
          </div>
          <SidebarBody user={user} newCount={newCount} onNavigate={close} />
        </aside>
      </div>

      <main id="admin-main" tabIndex={-1} className="min-w-0 flex-1 px-4 pt-14 pb-12 sm:px-6 lg:px-12 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
