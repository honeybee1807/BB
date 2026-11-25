import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/types/database";

type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];

export type Photo = {
  storage_path: string;
  thumb_path: string;
  alt_text: string;
  width: number | null;
  height: number | null;
  is_cover: boolean;
  sort_order: number;
};

type Place = { name: string; slug: string };

export type PropertySummary = Pick<
  PropertyRow,
  | "id"
  | "slug"
  | "name"
  | "max_guests"
  | "bedrooms"
  | "bathrooms"
  | "price_from_zar"
  | "is_halal"
  | "is_featured"
  | "featured_sort_order"
  | "updated_at"
  | "property_type"
> & {
  cover: Photo | null;
  estate: Place & { region: Place };
};

export type PropertyDetail = PropertyRow & {
  photos: Photo[];
  estate: Place & { region: Place };
};

const PHOTO = "storage_path, thumb_path, alt_text, width, height, is_cover, sort_order";
const PLACE = "estate:estates!inner(name, slug, region:regions!inner(name, slug))";
const SUMMARY = `id, slug, name, max_guests, bedrooms, bathrooms, price_from_zar, is_halal, is_featured, featured_sort_order, updated_at, property_type, ${PLACE}, photos:property_photos(${PHOTO})`;

function failed(what: string): never {
  throw new Error(`Could not load ${what}`);
}

function byPhotoOrder(a: Photo, b: Photo): number {
  return a.sort_order - b.sort_order;
}

export async function listProperties(): Promise<PropertySummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("listings");
  const { data, error } = await getPublicClient()
    .from("properties")
    .select(SUMMARY)
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("name");
  if (error) failed("properties");
  return data.map(({ photos, ...rest }) => ({
    ...rest,
    cover: photos.find((p) => p.is_cover) ?? null,
  }));
}

// Hand-picked first, then the most recently updated, and only homes with a cover photo.
export async function featuredProperties(limit = 3): Promise<PropertySummary[]> {
  const all = await listProperties();
  return all
    .filter((p) => p.cover)
    .sort(
      (a, b) =>
        Number(b.is_featured) - Number(a.is_featured) ||
        (a.is_featured ? a.featured_sort_order - b.featured_sort_order : 0) ||
        b.updated_at.localeCompare(a.updated_at),
    )
    .slice(0, limit);
}

export async function getProperty(slug: string): Promise<PropertyDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("listings");
  const { data, error } = await getPublicClient()
    .from("properties")
    .select(`*, ${PLACE}, photos:property_photos(${PHOTO})`)
    .eq("slug", slug)
    .eq("is_published", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) failed("the property");
  if (!data) return null;
  return { ...data, photos: [...data.photos].sort(byPhotoOrder) };
}

export type Region = Database["public"]["Tables"]["regions"]["Row"] & {
  estates: Database["public"]["Tables"]["estates"]["Row"][];
};

export async function listRegions(): Promise<Region[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("listings");
  const { data, error } = await getPublicClient()
    .from("regions")
    .select("*, estates(*)")
    .order("sort_order")
    .order("name");
  if (error) failed("regions");
  return data.map((r) => ({
    ...r,
    estates: [...r.estates].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
  }));
}

export async function getRegion(slug: string): Promise<Region | null> {
  const regions = await listRegions();
  return regions.find((r) => r.slug === slug) ?? null;
}

export type Post = Pick<
  Database["public"]["Tables"]["blog_posts"]["Row"],
  | "id"
  | "slug"
  | "title"
  | "excerpt"
  | "body_md"
  | "featured_image_path"
  | "published_at"
  | "updated_at"
  | "seo_title"
  | "seo_description"
>;

export async function listPosts(): Promise<Post[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("journal");
  const { data, error } = await getPublicClient()
    .from("blog_posts")
    .select(
      "id, slug, title, excerpt, body_md, featured_image_path, published_at, updated_at, seo_title, seo_description",
    )
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("published_at", { ascending: false });
  if (error) failed("journal posts");
  return data;
}

export async function getPost(slug: string): Promise<Post | null> {
  const posts = await listPosts();
  return posts.find((p) => p.slug === slug) ?? null;
}

export type SeoPage = { title: string | null; description: string | null; og_image_path: string | null };

export async function getSeoPage(path: string): Promise<SeoPage | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("seo");
  const { data, error } = await getPublicClient()
    .from("seo_pages")
    .select("title, description, og_image_path")
    .eq("path", path)
    .maybeSingle();
  if (error) failed("page details");
  return data;
}

// Cache Components needs at least one param at build time; the placeholder renders a 404.
export function staticParams<T extends Record<string, string>>(params: T[], placeholder: T): T[] {
  return params.length > 0 ? params : [placeholder];
}

export type Testimonial = { id: string; guest_name: string; place: string | null; quote: string };

export async function visibleTestimonials(limit = 3): Promise<Testimonial[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("testimonials");
  const { data, error } = await getPublicClient()
    .from("testimonials")
    .select("id, guest_name, place, quote")
    .eq("is_visible", true)
    .order("sort_order")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) failed("testimonials");
  return data;
}
