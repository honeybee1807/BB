import type { MetadataRoute } from "next";
import { listPosts, listProperties, listRegions } from "@/lib/data/public";
import { absoluteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [properties, regions, posts] = await Promise.all([listProperties(), listRegions(), listPosts()]);
  const pages = ["/", "/properties", "/about", "/contact", "/privacy", ...(posts.length ? ["/journal"] : [])];
  return [
    ...pages.map((path) => ({ url: absoluteUrl(path) })),
    ...regions.map((r) => ({ url: absoluteUrl(`/regions/${r.slug}`), lastModified: r.updated_at })),
    ...regions.flatMap((r) =>
      r.estates.map((e) => ({ url: absoluteUrl(`/regions/${r.slug}/${e.slug}`), lastModified: e.updated_at })),
    ),
    ...properties.map((p) => ({ url: absoluteUrl(`/properties/${p.slug}`), lastModified: p.updated_at })),
    ...posts.map((p) => ({ url: absoluteUrl(`/journal/${p.slug}`), lastModified: p.updated_at })),
  ];
}
