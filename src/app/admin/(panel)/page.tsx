import type { Metadata } from "next";
import { NotBuiltYet, PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/admin-session";

export const instant = false;

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const identity = await requireAdminPage();
  const firstName = identity.fullName.split(" ")[0] ?? identity.fullName;
  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        description="Inquiries, availability and recent activity at a glance."
      />
      <NotBuiltYet />
    </>
  );
}
