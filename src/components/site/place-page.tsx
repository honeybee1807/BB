import Image from "next/image";
import type { PropertySummary } from "@/lib/data/public";
import { publicImageUrl } from "@/lib/storage";
import { Breadcrumbs, type Crumb } from "./breadcrumbs";
import { PlainText } from "./plain-text";
import { PropertyCard } from "./property-card";
import { SectionHeading } from "./section-heading";

// Shared by region and estate pages.
export function PlacePage({
  crumbs,
  name,
  description,
  heroPath,
  properties,
  children,
}: {
  crumbs: Crumb[];
  name: string;
  description: string | null;
  heroPath: string | null;
  properties: PropertySummary[];
  children?: React.ReactNode;
}) {
  const halalCount = properties.filter((p) => p.is_halal).length;
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <div className="mt-8">
        <SectionHeading level={1} title={name} />
      </div>
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
        <div>
          <PlainText text={description} />
          {halalCount > 0 && (
            <p className="mt-6 text-sm text-muted">
              {halalCount === properties.length
                ? `Every home listed here offers halal accommodation.`
                : `${halalCount} of the homes listed here offer halal accommodation.`}
            </p>
          )}
        </div>
        {heroPath && (
          <div className="relative aspect-[3/2] overflow-hidden bg-mist">
            {/* already resized to WebP on upload */}
            <Image
              src={publicImageUrl("property-photos", heroPath)}
              alt={`${name}, South Africa`}
              fill
              unoptimized
              preload
              className="object-cover"
            />
          </div>
        )}
      </div>

      {children}

      <section aria-labelledby="homes-heading" className="mt-16">
        <h2 id="homes-heading" className="font-serif text-2xl text-navy uppercase">
          Homes in {name}
        </h2>
        {properties.length > 0 ? (
          <ul className="mt-8 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((p) => (
              <li key={p.id}>
                <PropertyCard property={p} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 border border-line px-6 py-10 text-center text-muted">
            New homes are being added here. Send us an inquiry and we&apos;ll suggest something that suits you.
          </p>
        )}
      </section>
    </>
  );
}
