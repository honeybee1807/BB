import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { InquiryCard } from "@/components/site/inquiry-form";
import { JsonLd } from "@/components/site/json-ld";
import { PropertyCard } from "@/components/site/property-card";
import { SectionHeading } from "@/components/site/section-heading";
import { TrustPoints } from "@/components/site/trust-points";
import { featuredProperties } from "@/lib/data/public";
import { publicEnv } from "@/lib/env";
import { absoluteUrl, staticPageMetadata } from "@/lib/seo";

// Checked at build time. Drop the real photo in public/images and the gradient makes way.
const hasHeroPhoto = existsSync(join(process.cwd(), "public", "images", "hero.webp"));

export function generateMetadata(): Promise<Metadata> {
  return staticPageMetadata("/", {
    title: "Halal Accommodation South Africa | Bargain Breaks",
    description: "Halal-conscious holiday homes from the coast to the mountains, personally reviewed by Naseema.",
  });
}

function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="on-dark relative h-[max(480px,62vh)] overflow-hidden bg-navy lg:h-[max(560px,72vh)]"
    >
      <div aria-hidden className="absolute inset-0 bg-linear-to-br from-navy via-navy-hover to-sand/70" />
      {hasHeroPhoto && <Image src="/images/hero.webp" alt="" fill preload sizes="100vw" className="object-cover" />}
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-t from-navy-deep/85 via-navy-deep/40 to-navy-deep/10 lg:bg-linear-to-r lg:from-navy-deep/80 lg:via-navy-deep/35 lg:to-transparent"
      />
      <div className="relative mx-auto flex h-full max-w-[1280px] items-end px-5 pb-12 sm:px-8 lg:pb-[9vh]">
        <div className="max-w-xl text-white lg:max-w-[calc(100%-480px)]">
          <p className="text-[11px] tracking-wide-plus uppercase sm:text-xs">Halal-conscious holiday homes</p>
          <h1
            id="hero-heading"
            className="mt-5 font-serif text-[clamp(2.6rem,1.2rem+4.4vw,4.6rem)] leading-[0.98] uppercase"
          >
            Coast to
            <br />
            mountain.
          </h1>
          <div aria-hidden className="mt-7 h-0.5 w-14 bg-gold" />
          <p className="mt-6 font-serif text-xl leading-snug sm:text-[25px]">
            Exceptional stays.
            <br />
            Cherished memories.
          </p>
          <Link
            href="/properties"
            className="mt-8 inline-block bg-navy px-9 py-4 text-xs font-bold tracking-[0.16em] text-white uppercase transition-colors duration-150 hover:bg-navy-hover"
          >
            Explore properties
          </Link>
        </div>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const featured = await featuredProperties();
  return (
    <>
      <JsonLd
        data={{
          "@type": "Organization",
          name: "Bargain Breaks",
          url: absoluteUrl("/"),
          description: "Halal-conscious holiday homes and resorts in South Africa, each one personally reviewed.",
        }}
      />
      <Hero />
      <div className="mx-auto max-w-[1280px] pb-20 sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-x-14 lg:pb-28">
        {/* pulled up into the hero on desktop; trust points follow it, so a taller form never covers them */}
        <div className="relative z-10 lg:col-start-2 lg:row-start-1 lg:-mt-[calc(max(560px,72vh)-96px)]">
          <InquiryCard siteKey={publicEnv.turnstileSiteKey} />
          <TrustPoints className="mt-14 hidden lg:flex" />
        </div>

        <section
          aria-labelledby="featured-heading"
          className="px-5 pt-16 sm:px-0 lg:col-start-1 lg:row-start-1 lg:pt-24"
        >
          <SectionHeading
            id="featured-heading"
            title="Featured properties"
            link={{ href: "/properties", label: "View all properties" }}
          />
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">
            A few of our favourite homes for families looking for halal accommodation, from the coast to the mountains.
          </p>
          {featured.length > 0 ? (
            <ul className="mt-9 grid gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
              {featured.map((property) => (
                <li key={property.id}>
                  <PropertyCard property={property} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-9 border border-line px-6 py-10 text-center text-muted">
              New homes are being added. Send us an inquiry and we&apos;ll suggest something that suits you.
            </p>
          )}
          <TrustPoints className="mt-16 lg:hidden" />
        </section>
      </div>
    </>
  );
}
