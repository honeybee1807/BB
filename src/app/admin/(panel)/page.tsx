import { ArrowRight, CalendarDays, FileText, House, Map as MapIcon, MessageCircle, Search, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AvailabilityGrid, AvailabilityLegend } from "@/components/admin/availability-grid";
import { AdminCard, outlineButton, pill } from "@/components/admin/card";
import { PageHeader } from "@/components/admin/page-header";
import { describeActivity, type ActivityKind } from "@/lib/activity";
import { STATUS_LABELS, firstName, greeting, initials, timeAgo } from "@/lib/admin-format";
import { requireAdminPage } from "@/lib/auth/admin-session";
import {
  adminProperties,
  blockedNights,
  listPostsAdmin,
  openInquiries,
  recentActivity,
  regionsWithEstates,
  type Activity,
} from "@/lib/data/admin";
import { addDays, todayInSast } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Overview" };

const ICONS: Record<ActivityKind, typeof House> = {
  inquiry: MessageCircle,
  home: House,
  post: FileText,
  dates: CalendarDays,
  place: MapIcon,
  team: Users,
  page: Search,
};

const twoDigits = (n: number) => String(n).padStart(2, "0");

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <li className="rounded-card bg-white p-6 ring-1 ring-line sm:p-8">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-6 font-serif text-[52px] leading-none text-navy">{twoDigits(value)}</p>
      <p className="mt-4 text-sm font-semibold text-teal">{note}</p>
    </li>
  );
}

function ActivityList({
  items,
  describe,
}: {
  items: Activity[];
  describe: (a: Activity) => [ActivityKind, string, string];
}) {
  if (items.length === 0) {
    return <p className="rounded-xl bg-admin-bg px-4 py-6 text-center text-sm text-muted">Nothing has changed yet.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((a) => {
        const [kind, title, detail] = describe(a);
        const Icon = ICONS[kind];
        return (
          <li key={a.id} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-frost text-navy">
              <Icon aria-hidden strokeWidth={1.5} className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-ink">{title}</span>
              <span className="mt-0.5 block text-sm text-muted">{detail}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default async function OverviewPage() {
  const identity = await requireAdminPage();
  const owner = identity.role === "owner";
  const supabase = await createClient();
  const today = todayInSast();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  const [homes, regions, open, freshCount, blocked, activity, posts, team] = await Promise.all([
    adminProperties(supabase),
    regionsWithEstates(supabase),
    openInquiries(supabase),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("status", "new")
      .is("deleted_at", null)
      .then((r) => r.count ?? 0),
    blockedNights(supabase, days[0]!, days.at(-1)!),
    owner ? recentActivity(supabase) : Promise.resolve([]),
    owner ? listPostsAdmin(supabase) : Promise.resolve([]),
    owner ? supabase.rpc("list_team").then((r) => r.data ?? []) : Promise.resolve([]),
  ]);

  const published = homes.filter((h) => h.is_published).length;
  const names = {
    homes: new Map(homes.map((h) => [h.id, h.name])),
    posts: new Map(posts.map((p) => [p.id, p.title])),
  };
  const people = new Map(team.map((m) => [m.id, firstName(m.full_name)]));
  const describe = (a: Activity): [ActivityKind, string, string] => {
    const { kind, title } = describeActivity(a, names);
    const who = (a.actor_id && people.get(a.actor_id)) || "Someone";
    return [kind, title, `${who} · ${timeAgo(a.created_at)}`];
  };

  const openList = (
    <AdminCard title="Open inquiries" action={<span className={`${pill} bg-frost text-teal`}>{open.total} open</span>}>
      {open.rows.length === 0 ? (
        <p className="rounded-xl bg-admin-bg px-4 py-6 text-center text-sm text-muted">
          No open inquiries. New ones will appear here.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {open.rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/inquiries?view=${r.id}`}
                className="-mx-2 flex items-center gap-4 rounded-xl px-2 py-4 hover:bg-admin-bg"
              >
                <span
                  aria-hidden
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-frost font-serif text-lg text-navy"
                >
                  {initials(r.guest_name).slice(0, 1)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">{r.guest_name}</span>
                  <span className="block truncate text-sm text-muted">
                    {r.property?.name ?? "No home chosen"} · {STATUS_LABELS[r.status]}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/admin/inquiries" className={`${outlineButton} mt-6 h-11 px-5`}>
        Manage inquiries
      </Link>
    </AdminCard>
  );

  return (
    <>
      <PageHeader title={`${greeting()}, ${firstName(identity.fullName)}`} />

      <ul className="grid gap-6 md:grid-cols-3">
        <Stat label="Total properties" value={homes.length} note={`${published} published on the site`} />
        <Stat
          label="Open inquiries"
          value={open.total}
          note={freshCount > 0 ? `${freshCount} waiting to be claimed` : "None waiting to be claimed"}
        />
        <Stat
          label="Regions covered"
          value={regions.length}
          note={regions.length > 0 ? regions.map((r) => r.name).join(", ") : "Add the first region"}
        />
      </ul>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {owner ? (
          <>
            <AdminCard title="Recent activity">
              <ActivityList items={activity} describe={describe} />
            </AdminCard>
            {openList}
          </>
        ) : (
          <div className="xl:col-span-2">{openList}</div>
        )}
      </div>

      <AdminCard
        title="Availability overview"
        description="Open and blocked nights for every home over the next 14 days."
        className="mt-6"
        action={
          <Link href="/admin/availability" className="inline-flex items-center gap-2 text-sm font-semibold text-teal">
            Full calendar
            <ArrowRight aria-hidden strokeWidth={1.75} className="size-4" />
          </Link>
        }
      >
        <AvailabilityGrid
          homes={homes}
          days={days}
          blocked={blocked}
          today={today}
          caption="Open and blocked nights for every home over the next 14 days"
        />
        <AvailabilityLegend />
      </AdminCard>
    </>
  );
}
