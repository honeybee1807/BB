import { Pencil, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, pill, primaryButton, tableHead } from "@/components/admin/card";
import { PageHeader } from "@/components/admin/page-header";
import { PublishToggle } from "@/components/admin/publish-toggle";
import { RegionsManager } from "@/components/admin/regions-manager";
import { ACCOMMODATION_LABELS } from "@/lib/admin-format";
import { requireAdminPage } from "@/lib/auth/admin-session";
import { listPropertiesAdmin, regionsWithEstates, type PropertyListRow } from "@/lib/data/admin";
import { formatRand } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Properties" };

const price = (h: PropertyListRow) => (h.price_from_zar ? `${formatRand(h.price_from_zar)} / night` : "No price shown");
const halal = <span className={`${pill} bg-frost text-teal`}>Halal</span>;

function EditLink({ home }: { home: PropertyListRow }) {
  return (
    <Link
      href={`/admin/properties/${home.id}`}
      className="inline-flex size-9 items-center justify-center rounded-full text-teal hover:bg-frost"
    >
      <Pencil aria-hidden strokeWidth={1.6} className="size-4" />
      <span className="sr-only">Edit {home.name}</span>
    </Link>
  );
}

export default async function PropertiesPage() {
  const identity = await requireAdminPage();
  const supabase = await createClient();
  const [homes, regions] = await Promise.all([
    listPropertiesAdmin(supabase),
    identity.role === "owner" ? regionsWithEstates(supabase) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Properties" />
      <div className="flex flex-col gap-6">
        <AdminCard
          title="Stay catalogue"
          description="Organised by region, estate and property."
          action={
            <Link href="/admin/properties/new" className={primaryButton}>
              <Plus aria-hidden strokeWidth={2} className="size-4" />
              Add new property
            </Link>
          }
        >
          {homes.length === 0 ? (
            <p className="rounded-xl bg-admin-bg px-4 py-6 text-center text-sm text-muted">
              No homes yet. Add the first one to start building the listings.
            </p>
          ) : (
            <div className="@container">
              <table className="hidden w-full text-left @3xl:table">
                <thead>
                  <tr className={`border-b border-line ${tableHead}`}>
                    <th scope="col" className="py-3 pr-4 font-semibold">
                      Property
                    </th>
                    <th scope="col" className="py-3 pr-4 font-semibold">
                      Hierarchy
                    </th>
                    <th scope="col" className="py-3 pr-4 font-semibold">
                      Guests
                    </th>
                    <th scope="col" className="py-3 pr-4 font-semibold">
                      Type
                    </th>
                    <th scope="col" className="py-3 pr-4 font-semibold">
                      Tag
                    </th>
                    <th scope="col" className="py-3 pr-4 font-semibold">
                      On the site
                    </th>
                    <th scope="col" className="w-12 py-3">
                      <span className="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {homes.map((h) => (
                    <tr key={h.id} className="border-b border-line last:border-0">
                      <td className="py-5 pr-4">
                        <Link href={`/admin/properties/${h.id}`} className="font-semibold text-navy hover:underline">
                          {h.name}
                        </Link>
                        <span className="mt-1 block text-sm text-muted">{price(h)}</span>
                      </td>
                      <td className="py-5 pr-4">
                        <span className="block text-ink">{h.estate.region.name}</span>
                        <span className="mt-1 block text-sm text-muted">{h.estate.name}</span>
                      </td>
                      <td className="py-5 pr-4 text-ink">{h.max_guests ?? "-"}</td>
                      <td className="py-5 pr-4 text-ink">{ACCOMMODATION_LABELS[h.property_type]}</td>
                      <td className="py-5 pr-4">{h.is_halal && halal}</td>
                      <td className="py-5 pr-4">
                        <PublishToggle url={`/api/admin/properties/${h.id}`} published={h.is_published} name={h.name} />
                      </td>
                      <td className="py-5 text-right">
                        <EditLink home={h} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <ul className="flex flex-col gap-3 @3xl:hidden">
                {homes.map((h) => (
                  <li key={h.id} className="rounded-2xl p-4 ring-1 ring-line">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/admin/properties/${h.id}`} className="font-semibold text-navy hover:underline">
                          {h.name}
                        </Link>
                        <p className="mt-1 text-sm text-muted">
                          {h.estate.region.name} · {h.estate.name}
                        </p>
                      </div>
                      <EditLink home={h} />
                    </div>
                    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink">
                      <span>{price(h)}</span>
                      {h.max_guests && <span>Sleeps {h.max_guests}</span>}
                      <span>{ACCOMMODATION_LABELS[h.property_type]}</span>
                      {h.is_halal && halal}
                    </p>
                    <div className="mt-3">
                      <PublishToggle url={`/api/admin/properties/${h.id}`} published={h.is_published} name={h.name} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </AdminCard>

        {identity.role === "owner" && <RegionsManager regions={regions} homes={homes} />}
      </div>
    </>
  );
}
