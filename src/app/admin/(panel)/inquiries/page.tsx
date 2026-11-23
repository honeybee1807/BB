import type { Metadata } from "next";
import { ComingInPhase, PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/admin-session";

export const instant = false;

export const metadata: Metadata = { title: "Inquiries" };

export default async function InquiriesPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Inquiries" description="Every guest inquiry, its status and who is handling it." />
      <ComingInPhase phase={6} />
    </>
  );
}
