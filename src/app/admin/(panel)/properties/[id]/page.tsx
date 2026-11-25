import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminCard } from "@/components/admin/card";
import { PageHeader } from "@/components/admin/page-header";
import { PhotoManager } from "@/components/admin/photo-manager";
import { PropertyForm } from "@/components/admin/property-form";
import { requireAdminPage } from "@/lib/auth/admin-session";
import { getPropertyAdmin, regionsWithEstates } from "@/lib/data/admin";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Edit home" };

export default async function EditPropertyPage({ params }: PageProps<"/admin/properties/[id]">) {
  await requireAdminPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [property, regions] = await Promise.all([getPropertyAdmin(supabase, id), regionsWithEstates(supabase)]);
  if (!property) notFound();
  const { photos, ...details } = property;

  return (
    <>
      <Link
        href="/admin/properties"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-navy hover:underline"
      >
        <ArrowLeft aria-hidden strokeWidth={1.5} className="size-4" />
        All homes
      </Link>
      <PageHeader title={property.name} description={property.is_published ? "Published" : "Not published"} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <AdminCard
          title="Details"
          action={
            property.is_published && (
              <a
                href={`/properties/${property.slug}`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 text-sm text-navy hover:underline"
              >
                View on the website
                <ExternalLink aria-hidden strokeWidth={1.5} className="size-4" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )
          }
        >
          <PropertyForm property={details} regions={regions} />
        </AdminCard>
        <AdminCard title="Photos" className="self-start">
          <PhotoManager propertyId={property.id} photos={photos} />
        </AdminCard>
      </div>
    </>
  );
}
