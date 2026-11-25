import type { Database } from "@/types/database";
import { AdminCard } from "./card";
import { PublishToggle } from "./publish-toggle";
import { TestimonialForm } from "./testimonial-form";

type Testimonial = Database["public"]["Tables"]["testimonials"]["Row"];

export function TestimonialsManager({ items, canDelete }: { items: Testimonial[]; canDelete: boolean }) {
  return (
    <AdminCard
      id="testimonials"
      title="Testimonials"
      description="The homepage section stays hidden until at least one testimonial is shown."
    >
      {items.length === 0 ? (
        <p className="rounded-xl bg-admin-bg px-4 py-6 text-center text-sm text-muted">
          No testimonials yet. Add the first one below.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((t) => (
            <li key={t.id} className="rounded-xl ring-1 ring-line">
              <div className="flex items-start gap-3 px-4 py-3">
                <details className="min-w-0 flex-1">
                  <summary className="cursor-pointer text-sm font-semibold text-navy">
                    {t.guest_name}
                    <span className="ml-2 font-normal text-muted">{t.is_visible ? "Shown" : "Hidden"}</span>
                  </summary>
                  <div className="pt-4">
                    <TestimonialForm item={t} canDelete={canDelete} />
                  </div>
                </details>
                <PublishToggle
                  url={`/api/admin/testimonials/${t.id}`}
                  published={t.is_visible}
                  name={t.guest_name}
                  field="is_visible"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <details className="mt-4 rounded-xl border border-dashed border-field">
        <summary className="cursor-pointer list-none rounded-xl px-4 py-3 text-sm font-semibold text-navy hover:bg-admin-bg [&::-webkit-details-marker]:hidden">
          Add a testimonial
        </summary>
        <div className="p-4">
          <TestimonialForm />
        </div>
      </details>
    </AdminCard>
  );
}
