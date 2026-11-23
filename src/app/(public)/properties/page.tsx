import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PropertyCard } from "@/components/site/property-card";
import { SectionHeading } from "@/components/site/section-heading";
import { listProperties, listRegions } from "@/lib/data/public";
import { plural } from "@/lib/format";
import { staticPageMetadata } from "@/lib/seo";

export function generateMetadata(): Promise<Metadata> {
  return staticPageMetadata("/properties", {
    title: "Holiday Homes and Resorts | Bargain Breaks",
    description: "Browse halal accommodation across the Drakensberg and beyond, with details of every home.",
  });
}

const select = "h-12 w-full rounded-public border border-field bg-white px-3 text-[15px] text-ink";

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

async function Listing({ searchParams }: { searchParams: PageProps<"/properties">["searchParams"] }) {
  const params = await searchParams;
  const halal = first(params.halal) === "1";
  const region = first(params.region);
  const estate = first(params.estate);
  const [properties, regions] = await Promise.all([listProperties(), listRegions()]);

  const shown = properties.filter(
    (p) =>
      (!halal || p.is_halal) && (!region || p.estate.region.slug === region) && (!estate || p.estate.slug === estate),
  );
  const filtered = halal || region || estate;

  return (
    <>
      <form
        method="get"
        className="mt-8 grid gap-4 border border-line p-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]"
      >
        <div>
          <label htmlFor="filter-region" className="mb-1.5 block text-[13px] font-medium text-navy">
            Region
          </label>
          <select id="filter-region" name="region" defaultValue={region} className={select}>
            <option value="">All regions</option>
            {regions.map((r) => (
              <option key={r.id} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-estate" className="mb-1.5 block text-[13px] font-medium text-navy">
            Estate
          </label>
          <select id="filter-estate" name="estate" defaultValue={estate} className={select}>
            <option value="">All estates</option>
            {regions.map((r) =>
              r.estates.length > 0 ? (
                <optgroup key={r.id} label={r.name}>
                  {r.estates.map((e) => (
                    <option key={e.id} value={e.slug}>
                      {e.name}
                    </option>
                  ))}
                </optgroup>
              ) : null,
            )}
          </select>
        </div>
        <div className="flex items-center gap-3 self-end pb-3">
          <input
            id="filter-halal"
            type="checkbox"
            name="halal"
            value="1"
            defaultChecked={halal}
            className="size-5 accent-teal"
          />
          <label htmlFor="filter-halal" className="text-[15px] text-ink">
            Halal accommodation only
          </label>
        </div>
        <div className="flex items-end gap-4">
          <button
            type="submit"
            className="h-12 bg-navy px-7 text-xs font-bold tracking-[0.16em] text-white uppercase hover:bg-navy-hover"
          >
            Show homes
          </button>
          {filtered && (
            <Link href="/properties" className="pb-3 text-sm text-navy underline underline-offset-4">
              Clear
            </Link>
          )}
        </div>
      </form>

      <p className="mt-8 text-sm text-muted" role="status">
        {plural(shown.length, "home", "homes")}
        {filtered ? " match your choices" : ""}
      </p>

      {shown.length > 0 ? (
        <ul className="mt-6 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <li key={p.id}>
              <PropertyCard property={p} headingLevel={2} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 border border-line px-6 py-10 text-center text-muted">
          {filtered
            ? "No homes match those choices. Try clearing a filter."
            : "New homes are being added. Send us an inquiry and we'll suggest something that suits you."}
        </p>
      )}
    </>
  );
}

export default function PropertiesPage({ searchParams }: PageProps<"/properties">) {
  return (
    <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-8 lg:py-20">
      <SectionHeading level={1} title="Our properties" />
      <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">
        Holiday homes and resorts from the coast to the mountains. Look for the halal accommodation badge, or filter for
        it below.
      </p>
      <Suspense fallback={<p className="mt-8 text-sm text-muted">Loading homes...</p>}>
        <Listing searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
