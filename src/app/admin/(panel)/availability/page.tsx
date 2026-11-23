import type { Metadata } from "next";
import { NotBuiltYet, PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/admin-session";

export const instant = false;

export const metadata: Metadata = { title: "Availability" };

export default async function AvailabilityPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Availability" description="Block and open nights for each property." />
      <NotBuiltYet />
    </>
  );
}
