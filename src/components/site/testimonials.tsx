import type { Testimonial } from "@/lib/data/public";
import { SectionHeading } from "./section-heading";

export function Testimonials({ items }: { items: Testimonial[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="testimonials-heading" className="mx-auto max-w-[1280px] px-5 pb-20 sm:px-8 lg:pb-28">
      <SectionHeading id="testimonials-heading" title="What our guests say" />
      <ul className="mt-9 grid gap-6 md:grid-cols-3">
        {items.map((t) => (
          <li key={t.id}>
            <figure className="flex h-full flex-col border border-line bg-white p-6">
              <blockquote className="flex-1 font-serif text-lg leading-relaxed whitespace-pre-line text-navy">
                {t.quote}
              </blockquote>
              <figcaption className="mt-5 text-sm text-muted">
                <span className="font-semibold text-ink">{t.guest_name}</span>
                {t.place && <>, {t.place}</>}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
