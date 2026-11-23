import type { Metadata } from "next";
import { ComingInPhase, PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/admin-session";

export const instant = false;

export const metadata: Metadata = { title: "Journal" };

export default async function JournalPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Journal" description="Write and publish journal posts." />
      <ComingInPhase phase={8} />
    </>
  );
}
