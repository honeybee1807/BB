import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { Gallery } from "@/components/site/gallery";
import { InquiryCard } from "@/components/site/inquiry-form";
import { InstagramEmbed } from "@/components/site/instagram-embed";
import { JsonLd } from "@/components/site/json-ld";
import { PlainText } from "@/components/site/plain-text";
import { HalalBadge, photoAlt, PriceFrom, PropertyFacts } from "@/components/site/property-card";
import { getProperty, listProperties, staticParams, type PropertyDetail } from "@/lib/data/public";
import { publicEnv } from "@/lib/env";
import { absoluteUrl, buildMetadata, trimDescription } from "@/lib/seo";
import { publicImageUrl } from "@/lib/storage";

export async function generateStaticParams() {
  const properties = await listProperties();
  return staticParams(
    properties.map((p) => ({ slug: p.slug })),
    { slug: "none" },
  );
}

function describe(p: PropertyDetail): string {
  const parts = [
    p.bedrooms !== null ? `${p.bedrooms} bedroom ${p.property_type === "resort" ? "unit" : "home"}` : "Home",
    p.max_guests !== null ? `sleeping ${p.max_guests}` : null,
    `in ${p.estate.name}, ${p.estate.region.name}.`,
  ];
  const tail = p.is_halal ? " Halal details and how to inquire." : " Details and how to inquire.";
  return parts.filter(Boolean).join(" ") + tail;
}

export async function generateMetadata({ params }: PageProps<"/properties/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProperty(slug);
  if (!p) return { title: "Not found", robots: { index: false } };
  const cover = p.photos.find((ph) => ph.is_cover) ?? p.photos[0];
  return buildMetadata(`/properties/${p.slug}`, {
    title:
      p.seo_title ??
      (p.is_halal
        ? `${p.name} | Halal Accommodation in ${p.estate.name}`
        : `${p.name}, ${p.estate.name} | Bargain Breaks`),
    description: p.seo_description ?? trimDescription(p.summary ?? describe(p)),
    image: cover ? publicImageUrl("property-photos", cover.storage_path) : null,
  });
}

function customFields(value: unknown): { label: string; value: string }[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (f): f is { label: string; value: string } =>
      typeof f === "object" && f !== null && typeof f.label === "string" && typeof f.value === "string",
  );
}

async function PropertyView({ params }: { params: PageProps<"/properties/[slug]">["params"] }) {
  const { slug } = await params;
  const p = await getProperty(slug);
  if (!p) notFound();

  const region = p.estate.region;
  const place = p.estate.name;
  const photos = p.photos.map((ph) => ({
    full: publicImageUrl("property-photos", ph.storage_path),
    thumb: publicImageUrl("property-photos", ph.thumb_path),
    alt: photoAlt(ph.alt_text, p.name, place, p.is_halal),
    width: ph.width ?? 1920,
    height: ph.height ?? 1280,
  }));
  const fields = customFields(p.custom_fields);
  const location = [p.town, place, region.name].filter(Boolean).join(", ");

  return (
    <>
      <JsonLd
        data={{
          "@type": "LodgingBusiness",
          name: p.name,
          url: absoluteUrl(`/properties/${p.slug}`),
          image: photos.map((ph) => ph.full),
          description: p.summary ?? describe(p),
          address: {
            "@type": "PostalAddress",
            ...(p.town ? { addressLocality: p.town } : {}),
            addressRegion: region.name,
            addressCountry: "ZA",
          },
        }}
      />
      <Breadcrumbs
        items={[
          { href: `/regions/${region.slug}`, label: region.name },
          { href: `/regions/${region.slug}/${p.estate.slug}`, label: place },
          { href: `/properties/${p.slug}`, label: p.name },
        ]}
      />

      <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14">
        <div className="min-w-0">
          {photos.length > 0 ? (
            <Gallery photos={photos} />
          ) : (
            <div aria-hidden className="aspect-[3/2] bg-linear-to-br from-navy/15 via-mist to-sand/60" />
          )}

          <div className="mt-10 border-b-2 border-navy pb-6">
            {p.is_halal && <HalalBadge className="mb-5" />}
            <h1 className="font-serif text-[32px] leading-tight text-navy sm:text-[40px]">{p.name}</h1>
            <p className="mt-3 flex items-center gap-2 text-sm text-muted">
              <MapPin aria-hidden strokeWidth={1.5} className="size-4" />
              {location}
            </p>
            <PropertyFacts
              guests={p.max_guests}
              bedrooms={p.bedrooms}
              bathrooms={p.bathrooms}
              className="mt-4 text-sm"
            />
            <PriceFrom amount={p.price_from_zar} className="mt-4" />
          </div>

          {p.summary && <p className="mt-8 font-serif text-xl leading-relaxed text-navy">{p.summary}</p>}
          <PlainText text={p.description} className="mt-6" />

          {p.is_halal && p.halal_details?.trim() && (
            <section aria-labelledby="halal-heading" className="mt-12 bg-teal-light/60 p-6 sm:p-8">
              <h2 id="halal-heading" className="text-[13px] font-bold tracking-[0.12em] text-teal uppercase">
                Halal details
              </h2>
              <PlainText text={p.halal_details} className="mt-4" />
            </section>
          )}

          {fields.length > 0 && (
            <section aria-labelledby="details-heading" className="mt-12">
              <h2 id="details-heading" className="font-serif text-2xl text-navy uppercase">
                Good to know
              </h2>
              <dl className="mt-5 divide-y divide-line border-y border-line">
                {fields.map((f) => (
                  <div key={f.label} className="grid gap-1 py-4 sm:grid-cols-[200px_1fr] sm:gap-6">
                    <dt className="text-sm font-semibold text-navy">{f.label}</dt>
                    <dd className="text-[15px] whitespace-pre-line text-ink">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {p.instagram_video_url && (
            <section aria-labelledby="video-heading" className="mt-12">
              <h2 id="video-heading" className="font-serif text-2xl text-navy uppercase">
                Take a look
              </h2>
              <div className="mt-5">
                <InstagramEmbed url={p.instagram_video_url} title={p.name} />
              </div>
            </section>
          )}
        </div>

        <div>
          <InquiryCard siteKey={publicEnv.turnstileSiteKey} property={{ id: p.id, name: p.name }} />
        </div>
      </div>
    </>
  );
}

export default function PropertyPage({ params }: PageProps<"/properties/[slug]">) {
  return (
    <div className="mx-auto max-w-[1280px] px-5 py-10 sm:px-8 lg:py-14">
      <Suspense fallback={<p className="text-sm text-muted">Loading the home...</p>}>
        <PropertyView params={params} />
      </Suspense>
    </div>
  );
}
