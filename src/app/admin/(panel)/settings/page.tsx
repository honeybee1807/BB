import type { Metadata } from "next";
import { ComingInPhase, PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/admin-session";

// Request-time only: reads the session; never prerendered.
export const instant = false;

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdminPage({ ownerOnly: true });
  return (
    <>
      <PageHeader title="Settings" description="Page titles and descriptions for search engines." />
      <ComingInPhase phase={8} />
    </>
  );
}
