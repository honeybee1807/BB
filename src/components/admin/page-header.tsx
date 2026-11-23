import { Bell, ExternalLink } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

async function newInquiryCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("status", "new")
    .is("deleted_at", null);
  return count ?? 0;
}

export async function PageHeader({ title, description }: { title: string; description?: string }) {
  const count = await newInquiryCount();
  const label = count === 0 ? "No new inquiries" : `${count} new ${count === 1 ? "inquiry" : "inquiries"}`;
  return (
    <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-serif text-[26px] leading-tight text-navy">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/admin/inquiries?status=new"
          className="relative flex size-10 items-center justify-center rounded-full bg-white text-navy shadow-sm ring-1 ring-line hover:bg-frost"
        >
          <Bell aria-hidden strokeWidth={1.5} className="size-5" />
          <span className="sr-only">{label}</span>
          {count > 0 && (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-alert px-1 text-[11px] font-semibold text-white"
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Link>
        <a
          href="/"
          target="_blank"
          rel="noopener"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-navy-hover"
        >
          View website
          <ExternalLink aria-hidden strokeWidth={1.5} className="size-4" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    </header>
  );
}

export function NotBuiltYet() {
  return <div className="rounded-card bg-white p-6 text-muted shadow-sm ring-1 ring-line">Not built yet.</div>;
}
