import type { PropertyListRow, RegionWithEstates } from "@/lib/data/admin";
import { AdminCard } from "./card";
import { PlaceForm } from "./place-form";

const summary =
  "flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-navy hover:bg-admin-bg [&::-webkit-details-marker]:hidden";

// Owner only. A region or estate can be deleted once nothing sits inside it.
export function RegionsManager({ regions, homes }: { regions: RegionWithEstates[]; homes: PropertyListRow[] }) {
  const homesIn = (estateId: string) => homes.filter((h) => h.estate_id === estateId).length;
  const regionOptions = regions.map((r) => ({ id: r.id, name: r.name }));

  return (
    <AdminCard
      id="regions"
      title="Regions & estates"
      description="Guests browse by region, then estate, then home. A region or estate can be deleted once it is empty."
    >
      <div className="flex flex-col gap-5">
        {regions.length === 0 && (
          <p className="rounded-xl bg-admin-bg px-4 py-6 text-center text-sm text-muted">
            No regions yet. Add the first one below.
          </p>
        )}
        {regions.map((region) => (
          <section key={region.id} aria-label={region.name} className="rounded-2xl p-4 ring-1 ring-line sm:p-5">
            <h3 className="font-serif text-xl text-navy">{region.name}</h3>
            <details className="mt-3 rounded-xl ring-1 ring-line">
              <summary className={summary}>
                Edit region details <span className="text-xs font-normal text-muted">/regions/{region.slug}</span>
              </summary>
              <div className="p-4">
                <PlaceForm kind="region" place={region} canDelete={region.estates.length === 0} />
              </div>
            </details>

            <h4 className="mt-5 mb-2 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Estates</h4>
            {region.estates.length === 0 && <p className="mb-2 text-sm text-muted">No estates in this region yet.</p>}
            <ul className="flex flex-col gap-2">
              {region.estates.map((estate) => {
                const count = homesIn(estate.id);
                return (
                  <li key={estate.id}>
                    <details className="rounded-xl ring-1 ring-line">
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
                <details className="rounded-xl border border-dashed border-field">
                  <summary className={summary}>Add an estate to {region.name}</summary>
                  <div className="p-4">
                    <PlaceForm kind="estate" regions={regionOptions} regionId={region.id} />
                  </div>
                </details>
              </li>
            </ul>
          </section>
        ))}
        <details className="rounded-2xl border border-dashed border-field">
          <summary className={summary}>Add a region</summary>
          <div className="p-4">
            <PlaceForm kind="region" />
          </div>
        </details>
      </div>
    </AdminCard>
  );
}
