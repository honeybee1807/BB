import type { Metadata } from "next";
import { ComingInPhase, PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/admin-session";

// Request-time only: reads the session; never prerendered.
export const instant = false;

export const metadata: Metadata = { title: "Availability" };

export default async function AvailabilityPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Availability" description="Block and open nights for each property." />
      <ComingInPhase phase={6} />
    </>
  );
}
