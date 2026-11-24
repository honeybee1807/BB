import { House, Plus } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AdminCard } from "@/components/admin/card";
import { PageHeader } from "@/components/admin/page-header";
import { PublishToggle } from "@/components/admin/publish-toggle";
import { requireAdminPage } from "@/lib/auth/admin-session";
import { listPropertiesAdmin } from "@/lib/data/admin";
import { publicImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Properties" };

export default async function PropertiesPage() {
  await requireAdminPage();
  const homes = await listPropertiesAdmin(await createClient());

  return (
    <>
      <PageHeader title="Properties" description="Add and edit homes, their photos and details." />
      <AdminCard
        title={`${homes.length} ${homes.length === 1 ? "home" : "homes"}`}
        icon={House}
        action={
          <Link
            href="/admin/properties/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal px-3 text-sm font-medium text-white hover:bg-teal-hover"
          >
            <Plus aria-hidden strokeWidth={1.5} className="size-4" />
            Add a home
          </Link>
        }
      >
        {homes.length === 0 ? (
          <p className="rounded-lg bg-admin-bg px-4 py-6 text-center text-sm text-muted">
            No homes yet. Add the first one to start building the listings.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {homes.map((h) => {
              const cover = h.photos.find((p) => p.is_cover) ?? h.photos[0];
              const facts = [
                `${h.estate.name}, ${h.estate.region.name}`,
                h.max_guests ? `sleeps ${h.max_guests}` : null,
                h.is_halal ? "halal-friendly" : null,
                `${h.photos.length} ${h.photos.length === 1 ? "photo" : "photos"}`,
              ].filter(Boolean);
              return (
                <li key={h.id} className="flex items-center gap-4 py-3">
                  <div className="relative hidden aspect-[3/2] w-20 shrink-0 overflow-hidden rounded-md bg-admin-bg sm:block">
                    {cover && (
                      <Image
                        src={publicImageUrl("property-photos", cover.thumb_path)}
                        alt=""
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/properties/${h.id}`}
                      className="font-medium text-navy underline-offset-2 hover:underline"
                    >
                      {h.name}
                    </Link>
                    <p className="text-xs text-muted">{facts.join(", ")}</p>
                  </div>
                  <PublishToggle url={`/api/admin/properties/${h.id}`} published={h.is_published} name={h.name} />
                </li>
              );
            })}
          </ul>
        )}
      </AdminCard>
    </>
  );
}
