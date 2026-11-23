import type { Metadata } from "next";
import { ComingInPhase, PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/admin-session";

// Request-time only: reads the session; never prerendered.
export const instant = false;

export const metadata: Metadata = { title: "Properties" };

export default async function PropertiesPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Properties" description="Add and edit properties, photos and details." />
      <ComingInPhase phase={7} />
    </>
  );
}
