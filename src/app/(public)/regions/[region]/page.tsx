import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PlacePage } from "@/components/site/place-page";
import { getRegion, listProperties, listRegions, staticParams } from "@/lib/data/public";
import { plural } from "@/lib/format";
import { buildMetadata } from "@/lib/seo";
import { publicImageUrl } from "@/lib/storage";

export async function generateStaticParams() {
  const regions = await listRegions();
  return staticParams(
    regions.map((r) => ({ region: r.slug })),
    { region: "none" },
  );
}

export async function generateMetadata({ params }: PageProps<"/regions/[region]">): Promise<Metadata> {
  const region = await getRegion((await params).region);
  if (!region) return { title: "Not found", robots: { index: false } };
  return buildMetadata(`/regions/${region.slug}`, {
    title: region.seo_title ?? `Halal Accommodation in ${region.name} | Bargain Breaks`,
    description:
      region.seo_description ??
      `Halal holiday homes in ${region.name}, with estates, sleeping capacity and facilities.`,
    image: region.hero_image_path ? publicImageUrl("property-photos", region.hero_image_path) : null,
  });
}

async function RegionView({ params }: { params: PageProps<"/regions/[region]">["params"] }) {
  const region = await getRegion((await params).region);
  if (!region) notFound();
  const properties = (await listProperties()).filter((p) => p.estate.region.slug === region.slug);

  return (
    <PlacePage
      crumbs={[{ href: `/regions/${region.slug}`, label: region.name }]}
      name={region.name}
      description={region.description}
      heroPath={region.hero_image_path}
      properties={properties}
    >
      {region.estates.length > 0 && (
        <section aria-labelledby="estates-heading" className="mt-16">
          <h2 id="estates-heading" className="font-serif text-2xl text-navy uppercase">
            Estates
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {region.estates.map((e) => {
              const count = properties.filter((p) => p.estate.slug === e.slug).length;
              return (
                <li key={e.id}>
                  <Link
                    href={`/regions/${region.slug}/${e.slug}`}
                    className="block border border-line p-5 transition-colors duration-150 hover:border-navy"
                  >
                    <span className="block font-serif text-xl text-navy">{e.name}</span>
                    <span className="mt-1 block text-sm text-muted">{plural(count, "home", "homes")}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </PlacePage>
  );
}

export default function RegionPage({ params }: PageProps<"/regions/[region]">) {
  return (
    <div className="mx-auto max-w-[1280px] px-5 py-10 sm:px-8 lg:py-14">
      <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
        <RegionView params={params} />
      </Suspense>
    </div>
  );
}
