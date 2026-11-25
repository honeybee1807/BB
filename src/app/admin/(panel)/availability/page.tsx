import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AvailabilityCalendar } from "@/components/admin/availability-calendar";
import { AvailabilityGrid, AvailabilityLegend } from "@/components/admin/availability-grid";
import { AdminCard, outlineButton } from "@/components/admin/card";
import { PageHeader } from "@/components/admin/page-header";
import { dateRangeLabel } from "@/lib/admin-format";
import { requireAdminPage } from "@/lib/auth/admin-session";
import { isMonthKey, monthGrid, monthKey, monthLabel } from "@/lib/calendar";
import { adminProperties, blockedNights } from "@/lib/data/admin";
import { addDays, todayInSast } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Availability" };

const DAYS = 28;

export default async function AvailabilityPage({ searchParams }: PageProps<"/admin/availability">) {
  await requireAdminPage();
  const params = await searchParams;
  const supabase = await createClient();
  const today = todayInSast();

  const homes = await adminProperties(supabase);
  const homeParam = typeof params.home === "string" ? params.home : undefined;
  const home = homes.find((h) => h.id === homeParam) ?? homes[0] ?? null;
  const monthParam = typeof params.month === "string" ? params.month : undefined;
  const month = isMonthKey(monthParam) ? monthParam : monthKey(today);
  const weeks = monthGrid(month);
  const startParam = typeof params.from === "string" ? params.from : "";
  const start = /^\d{4}-\d{2}-\d{2}$/.test(startParam) ? startParam : today;
  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));

  const [gridBlocked, calendarBlocked] = await Promise.all([
    blockedNights(supabase, days[0]!, days.at(-1)!),
    home
      ? blockedNights(supabase, weeks[0]![0]!.date, weeks.at(-1)!.at(-1)!.date, home.id)
      : Promise.resolve([] as string[]),
  ]);

  const gridLink = (from: string) => {
    const next = new URLSearchParams();
    if (home) next.set("home", home.id);
    next.set("month", month);
    next.set("from", from);
    return `/admin/availability?${next.toString()}`;
  };

  return (
    <>
      <PageHeader title="Availability" />
      <div className="flex flex-col gap-6">
        <AdminCard
          title={home?.name ?? "Calendar"}
          description={`${monthLabel(month, true)} · select a date to block or open it. Guests never see this unless public availability is switched on.`}
        >
          <AvailabilityCalendar
            homes={homes}
            homeId={home?.id ?? null}
            month={month}
            blocked={calendarBlocked.map((k) => k.split("|")[1]!)}
            today={today}
          />
          <AvailabilityLegend />
        </AdminCard>

        <AdminCard
          title="All homes"
          description={`${dateRangeLabel(days[0]!, days.at(-1)!)}. Select a night to block it, or a blocked night to open it.`}
          className="min-w-0"
          action={
            <div className="flex items-center gap-2">
              <Link href={gridLink(addDays(start, -DAYS))} className={outlineButton}>
                <ChevronLeft aria-hidden strokeWidth={1.5} className="size-4" />
                <span className="sr-only">Previous four weeks</span>
              </Link>
              {start !== today && (
                <Link href={gridLink(today)} className={outlineButton}>
                  Today
                </Link>
              )}
              <Link href={gridLink(addDays(start, DAYS))} className={outlineButton}>
                <ChevronRight aria-hidden strokeWidth={1.5} className="size-4" />
                <span className="sr-only">Next four weeks</span>
              </Link>
            </div>
          }
        >
          <AvailabilityGrid
            homes={homes}
            days={days}
            blocked={gridBlocked}
            today={today}
            interactive
            caption={`Open and blocked nights for every home, ${dateRangeLabel(days[0]!, days.at(-1)!)}`}
          />
          <AvailabilityLegend />
        </AdminCard>
      </div>
    </>
  );
}
