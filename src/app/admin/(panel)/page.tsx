import type { Metadata } from "next";
import { ComingInPhase, PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/admin-session";

// Request-time only: reads the session; never prerendered.
export const instant = false;

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const identity = await requireAdminPage();
  const firstName = identity.fullName.split(" ")[0] ?? identity.fullName;
  return (
    <>
      <PageHeader title={`Welcome, ${firstName}`} description="Inquiries, availability and recent activity at a glance." />
      <ComingInPhase phase={6} />
    </>
  );
}
