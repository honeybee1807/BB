import { Quote } from "lucide-react";
import type { Metadata } from "next";
import { AdminCard } from "@/components/admin/card";
import { PageHeader } from "@/components/admin/page-header";
import { PublishToggle } from "@/components/admin/publish-toggle";
import { TestimonialForm } from "@/components/admin/testimonial-form";
import { requireAdminPage } from "@/lib/auth/admin-session";
import { listTestimonialsAdmin } from "@/lib/data/admin";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Testimonials" };

export default async function TestimonialsPage() {
  const identity = await requireAdminPage();
  const items = await listTestimonialsAdmin(await createClient());

  return (
    <>
      <PageHeader
        title="Testimonials"
        description="The homepage section stays hidden until at least one testimonial is shown."
      />
      <div className="flex flex-col gap-6">
        <AdminCard title={`${items.length} ${items.length === 1 ? "testimonial" : "testimonials"}`} icon={Quote}>
          {items.length === 0 ? (
            <p className="rounded-lg bg-admin-bg px-4 py-6 text-center text-sm text-muted">
              No testimonials yet. Add the first one below.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((t) => (
                <li key={t.id} className="rounded-lg ring-1 ring-line">
                  <div className="flex items-start gap-3 px-3 py-2.5">
                    <details className="min-w-0 flex-1">
                      <summary className="cursor-pointer text-sm font-medium text-navy">
                        {t.guest_name}
                        <span className="ml-2 font-normal text-muted">{t.is_visible ? "Shown" : "Hidden"}</span>
                      </summary>
                      <div className="pt-4">
                        <TestimonialForm item={t} canDelete={identity.role === "owner"} />
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
        </AdminCard>
        <AdminCard title="Add a testimonial">
          <TestimonialForm />
        </AdminCard>
      </div>
    </>
  );
}
