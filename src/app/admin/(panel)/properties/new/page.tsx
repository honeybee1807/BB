import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard } from "@/components/admin/card";
import { PageHeader } from "@/components/admin/page-header";
import { PropertyForm } from "@/components/admin/property-form";
import { requireAdminPage } from "@/lib/auth/admin-session";
import { regionsWithEstates } from "@/lib/data/admin";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Add a home" };

export default async function NewPropertyPage() {
  const identity = await requireAdminPage();
  const regions = await regionsWithEstates(await createClient());
  const hasEstates = regions.some((r) => r.estates.length > 0);

  return (
    <>
      <PageHeader title="Add a home" description="You can add photos once the home is saved." />
      <AdminCard title="Details">
        {hasEstates ? (
          <PropertyForm regions={regions} />
        ) : (
          <p className="text-sm text-muted">
            Every home belongs to an estate, and there are none yet.{" "}
            {identity.role === "owner" ? (
              <Link href="/admin/regions" className="text-navy underline underline-offset-2">
                Add a region and an estate first.
              </Link>
            ) : (
              "Ask the owner to add a region and an estate first."
            )}
          </p>
        )}
      </AdminCard>
    </>
  );
}
