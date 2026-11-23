import type { Metadata } from "next";
import { ComingInPhase, PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/admin-session";

export const instant = false;

export const metadata: Metadata = { title: "Regions and estates" };

export default async function RegionsandestatesPage() {
  await requireAdminPage({ ownerOnly: true });
  return (
    <>
      <PageHeader title="Regions and estates" description="The Region > Estate > Property hierarchy." />
      <ComingInPhase phase={7} />
    </>
  );
}
