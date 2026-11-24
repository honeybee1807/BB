import { Map as MapIcon } from "lucide-react";
import type { Metadata } from "next";
import { AdminCard } from "@/components/admin/card";
import { PageHeader } from "@/components/admin/page-header";
import { PlaceForm } from "@/components/admin/place-form";
import { requireAdminPage } from "@/lib/auth/admin-session";
import { listPropertiesAdmin, regionsWithEstates } from "@/lib/data/admin";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Regions & estates" };

const summary =
  "flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-navy hover:bg-admin-bg [&::-webkit-details-marker]:hidden";

export default async function RegionsPage() {
  await requireAdminPage({ ownerOnly: true });
  const supabase = await createClient();
  const [regions, homes] = await Promise.all([regionsWithEstates(supabase), listPropertiesAdmin(supabase)]);
  const homesIn = (estateId: string) => homes.filter((h) => h.estate_id === estateId).length;
  const regionOptions = regions.map((r) => ({ id: r.id, name: r.name }));

  return (
    <>
      <PageHeader
        title="Regions & estates"
        description="Guests browse by region, then estate, then home. A region or estate can be deleted once it is empty."
      />
      <div className="flex flex-col gap-6">
        {regions.length === 0 && (
          <p className="rounded-card bg-white p-6 text-sm text-muted shadow-sm ring-1 ring-line">
            No regions yet. Add the first one below.
          </p>
        )}
        {regions.map((region) => (
          <AdminCard key={region.id} title={region.name} icon={MapIcon}>
            <details className="rounded-lg ring-1 ring-line">
              <summary className={summary}>
                Edit region details <span className="text-xs font-normal text-muted">/regions/{region.slug}</span>
              </summary>
              <div className="p-4">
                <PlaceForm kind="region" place={region} canDelete={region.estates.length === 0} />
              </div>
            </details>

            <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Estates</h3>
            {region.estates.length === 0 && <p className="mb-2 text-sm text-muted">No estates in this region yet.</p>}
            <ul className="flex flex-col gap-2">
              {region.estates.map((estate) => {
                const count = homesIn(estate.id);
                return (
                  <li key={estate.id}>
                    <details className="rounded-lg ring-1 ring-line">
                      <summary className={summary}>
                        {estate.name}
                        <span className="text-xs font-normal text-muted">
                          {count} {count === 1 ? "home" : "homes"}
                        </span>
                      </summary>
                      <div className="p-4">
                        <PlaceForm kind="estate" place={estate} regions={regionOptions} canDelete={count === 0} />
                      </div>
                    </details>
                  </li>
                );
              })}
              <li>
                <details className="rounded-lg border border-dashed border-line">
                  <summary className={summary}>Add an estate to {region.name}</summary>
                  <div className="p-4">
                    <PlaceForm kind="estate" regions={regionOptions} regionId={region.id} />
                  </div>
                </details>
              </li>
            </ul>
          </AdminCard>
        ))}
        <AdminCard title="Add a region">
          <PlaceForm kind="region" />
        </AdminCard>
      </div>
    </>
  );
}
