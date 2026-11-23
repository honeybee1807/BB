import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PlacePage } from "@/components/site/place-page";
import { getRegion, listProperties, listRegions, staticParams } from "@/lib/data/public";
import { buildMetadata } from "@/lib/seo";
import { publicImageUrl } from "@/lib/storage";

type Params = PageProps<"/regions/[region]/[estate]">["params"];

export async function generateStaticParams() {
  const regions = await listRegions();
  return staticParams(
    regions.flatMap((r) => r.estates.map((e) => ({ region: r.slug, estate: e.slug }))),
    { region: "none", estate: "none" },
  );
}

async function find(params: Params) {
  const { region: regionSlug, estate: estateSlug } = await params;
  const region = await getRegion(regionSlug);
  const estate = region?.estates.find((e) => e.slug === estateSlug);
  return region && estate ? { region, estate } : null;
}

export async function generateMetadata({ params }: PageProps<"/regions/[region]/[estate]">): Promise<Metadata> {
  const found = await find(params);
  if (!found) return { title: "Not found", robots: { index: false } };
  const { region, estate } = found;
  return buildMetadata(`/regions/${region.slug}/${estate.slug}`, {
    title: estate.seo_title ?? `${estate.name}, ${region.name} | Halal Holiday Homes`,
    description:
      estate.seo_description ??
      `Stay at ${estate.name} in ${region.name}. Halal-conscious homes, one personal confirmation.`,
    image: estate.hero_image_path ? publicImageUrl("property-photos", estate.hero_image_path) : null,
  });
}

async function EstateView({ params }: { params: Params }) {
  const found = await find(params);
  if (!found) notFound();
  const { region, estate } = found;
  const properties = (await listProperties()).filter((p) => p.estate.slug === estate.slug);
  return (
    <PlacePage
      crumbs={[
        { href: `/regions/${region.slug}`, label: region.name },
        { href: `/regions/${region.slug}/${estate.slug}`, label: estate.name },
      ]}
      name={estate.name}
      description={estate.description}
      heroPath={estate.hero_image_path}
      properties={properties}
    />
  );
}

export default function EstatePage({ params }: PageProps<"/regions/[region]/[estate]">) {
  return (
    <div className="mx-auto max-w-[1280px] px-5 py-10 sm:px-8 lg:py-14">
      <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
        <EstateView params={params} />
      </Suspense>
    </div>
  );
}
