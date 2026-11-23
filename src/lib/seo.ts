import type { Metadata } from "next";
import { getSeoPage } from "@/lib/data/public";
import { publicEnv } from "@/lib/env";
import { publicImageUrl } from "@/lib/storage";

export function absoluteUrl(path: string): string {
  return `${publicEnv.siteUrl}${path}`;
}

type PageSeo = { title: string; description: string; image?: string | null };

// The logo on white, used when a page has no photo of its own.
export const SHARE_IMAGE = { url: "/images/share.jpg", width: 1200, height: 630, alt: "Bargain Breaks" };

// Titles are stored complete, so the layout's title template must not add to them.
export function buildMetadata(path: string, seo: PageSeo): Metadata {
  const images = seo.image ? [seo.image] : [SHARE_IMAGE];
  return {
    title: { absolute: seo.title },
    description: seo.description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_ZA",
      siteName: "Bargain Breaks",
      url: path,
      title: seo.title,
      description: seo.description,
      images,
    },
    twitter: { card: "summary_large_image", title: seo.title, description: seo.description, images },
  };
}

export async function staticPageMetadata(path: string, fallback: PageSeo): Promise<Metadata> {
  const row = await getSeoPage(path);
  if (!row) return buildMetadata(path, fallback);
  return buildMetadata(path, {
    title: row.title,
    description: row.description,
    image: row.og_image_path ? publicImageUrl("property-photos", row.og_image_path) : null,
  });
}

export function trimDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, clean.lastIndexOf(" ", max - 1))}...`;
}
