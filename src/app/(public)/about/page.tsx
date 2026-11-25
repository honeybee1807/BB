import type { Metadata } from "next";
import Link from "next/link";
import { DraftNotice } from "@/components/site/draft-notice";
import { SectionHeading } from "@/components/site/section-heading";
import { TrustPoints } from "@/components/site/trust-points";
import { staticPageMetadata } from "@/lib/seo";

export function generateMetadata(): Promise<Metadata> {
  return staticPageMetadata("/about");
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-8 lg:py-20">
      <SectionHeading level={1} title="About us" />
      <div className="mt-6 max-w-2xl">
        <DraftNotice />
      </div>
      <div className="mt-10 grid gap-14 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex max-w-2xl flex-col gap-5 text-[17px] leading-relaxed text-ink">
          <p className="font-serif text-2xl leading-snug text-navy">
            Bargain Breaks is a small, personal collection of holiday homes and resorts in South Africa, from the coast
            to the mountains.
          </p>
          <p>
            Naseema and her team choose every property themselves. We look for comfortable, well-kept homes where
            families can relax, and we note clearly which ones offer halal accommodation and what that means at each
            home.
          </p>
          <p>
            There is no instant booking. When you send an inquiry, a real person reads it, checks the dates with the
            home and comes back to you. It takes a little longer, but it means no double-bookings and no surprises.
          </p>
          <p>Tell us where you would like to go, when, and who is coming. We will help you find the right stay.</p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link
              href="/properties"
              className="bg-navy px-8 py-4 text-xs font-bold tracking-[0.16em] text-white uppercase hover:bg-navy-hover"
            >
              Explore properties
            </Link>
            <Link
              href="/contact"
              className="border border-navy px-8 py-4 text-xs font-bold tracking-[0.16em] text-navy uppercase hover:bg-navy hover:text-white"
            >
              Send an inquiry
            </Link>
          </div>
        </div>
        <TrustPoints headingLevel={2} />
      </div>
    </div>
  );
}
