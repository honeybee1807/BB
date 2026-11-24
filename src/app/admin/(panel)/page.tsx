import { CalendarDays, LayoutGrid, MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AvailabilityCalendar } from "@/components/admin/availability-calendar";
import { AvailabilityGrid, AvailabilityLegend } from "@/components/admin/availability-grid";
import { AdminCard, outlineButton } from "@/components/admin/card";
import { InquiryTable } from "@/components/admin/inquiry-table";
import { PageHeader } from "@/components/admin/page-header";
import { StatTiles } from "@/components/admin/stat-tiles";
import { firstName } from "@/lib/admin-format";
import { requireAdminPage } from "@/lib/auth/admin-session";
import { isMonthKey, monthGrid, monthKey } from "@/lib/calendar";
import { activeAdmins, adminProperties, blockedNights, dashboardCounts, recentInquiries } from "@/lib/data/admin";
import { addDays, todayInSast } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  const identity = await requireAdminPage();
  const params = await searchParams;
  const supabase = await createClient();
  const today = todayInSast();

  const homes = await adminProperties(supabase);
  const homeParam = typeof params.home === "string" ? params.home : undefined;
  const home = homes.find((h) => h.id === homeParam) ?? homes[0] ?? null;
  const monthParam = typeof params.month === "string" ? params.month : undefined;
  const month = isMonthKey(monthParam) ? monthParam : monthKey(today);
  const weeks = monthGrid(month);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  const [inquiries, admins, counts, gridBlocked, calendarBlocked] = await Promise.all([
    recentInquiries(supabase),
    activeAdmins(supabase),
    dashboardCounts(supabase),
    blockedNights(supabase, days[0]!, days.at(-1)!),
    home
      ? blockedNights(supabase, weeks[0]![0]!.date, weeks.at(-1)!.at(-1)!.date, home.id)
      : Promise.resolve([] as string[]),
  ]);

  return (
    <>
      <PageHeader title="Dashboard" description={`Welcome back, ${firstName(identity.fullName)}`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <AdminCard
            title="Inquiry Management"
            icon={MessageSquare}
            action={
              <Link href="/admin/inquiries" className={outlineButton}>
                View all
              </Link>
            }
          >
            <InquiryTable rows={inquiries} admins={admins} />
          </AdminCard>

          <AdminCard
            title="Availability Overview"
            icon={LayoutGrid}
            action={
              <Link href="/admin/availability" className={outlineButton}>
                View full grid
              </Link>
            }
          >
            <AvailabilityGrid
              homes={homes}
              days={days}
              blocked={gridBlocked}
              today={today}
              caption="Open and blocked nights for every home over the next 14 days"
            />
            <AvailabilityLegend />
          </AdminCard>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <AdminCard title="Manual Availability Calendar" icon={CalendarDays}>
            <AvailabilityCalendar
              homes={homes}
              homeId={home?.id ?? null}
              month={month}
              blocked={calendarBlocked.map((k) => k.split("|")[1]!)}
              today={today}
            />
            <AvailabilityLegend />
          </AdminCard>

          <AdminCard title="Overview">
            <StatTiles counts={counts} />
          </AdminCard>
        </div>
      </div>
    </>
  );
}
