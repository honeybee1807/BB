import { Bath, BedDouble, Moon, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { PropertySummary } from "@/lib/data/public";
import { formatRand, plural } from "@/lib/format";
import { publicImageUrl } from "@/lib/storage";

export function HalalBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 bg-teal px-3 py-2 text-[10px] leading-[1.15] font-bold tracking-[0.08em] text-white uppercase ${className}`}
    >
      <Moon aria-hidden strokeWidth={1.5} className="size-3.5 fill-white" />
      <span>
        Halal <br />
        accommodation
      </span>
    </span>
  );
}

export function photoAlt(alt: string, name: string, place: string, isHalal: boolean): string {
  if (alt.trim()) return alt;
  return isHalal ? `${name}, halal accommodation in ${place}` : `${name} in ${place}`;
}

export function PropertyFacts({
  guests,
  bedrooms,
  bathrooms,
  className = "",
}: {
  guests: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  className?: string;
}) {
  const facts = [
    guests !== null && { icon: User, text: plural(guests, "Guest", "Guests") },
    bedrooms !== null && { icon: BedDouble, text: plural(bedrooms, "Bedroom", "Bedrooms") },
    bathrooms !== null && { icon: Bath, text: plural(bathrooms, "Bathroom", "Bathrooms") },
  ].filter((f) => f !== false);
  if (facts.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-muted ${className}`}>
      {facts.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-1">
          <Icon aria-hidden strokeWidth={1.5} className="size-3.5" />
          {text}
        </li>
      ))}
    </ul>
  );
}

export function PriceFrom({ amount, className = "" }: { amount: number | null; className?: string }) {
  if (amount === null) return null;
  return (
    <p className={`text-sm text-muted ${className}`}>
      From <span className="text-lg font-bold text-teal">{formatRand(amount)}</span> / night
    </p>
  );
}

export function PropertyCard({ property, headingLevel = 3 }: { property: PropertySummary; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const { cover } = property;
  return (
    <Link href={`/properties/${property.slug}`} className="group block">
      <div className="relative aspect-[8/5] overflow-hidden bg-mist">
        {cover ? (
          // already resized to a 640px WebP thumbnail on upload
          <Image
            src={publicImageUrl("property-photos", cover.thumb_path)}
            alt={photoAlt(cover.alt_text, property.name, property.estate.name, property.is_halal)}
            fill
            unoptimized
            className="object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div aria-hidden className="absolute inset-0 bg-linear-to-br from-navy/15 via-mist to-sand/60" />
        )}
        {property.is_halal && <HalalBadge className="absolute top-4 left-4" />}
      </div>
      <Heading className="mt-5 font-serif text-[22px] leading-snug text-navy group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
        {property.name}
      </Heading>
      <PropertyFacts
        guests={property.max_guests}
        bedrooms={property.bedrooms}
        bathrooms={property.bathrooms}
        className="mt-2"
      />
      <PriceFrom amount={property.price_from_zar} className="mt-3" />
    </Link>
  );
}
