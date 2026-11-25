import "server-only";
import { addDays } from "@/lib/format";
import type { InquiryStatus } from "@/lib/admin-format";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

// Every read uses the signed-in user's session, so RLS decides what they see.
type UserClient = Awaited<ReturnType<typeof createClient>>;

function failed(what: string): never {
  throw new Error(`Could not load ${what}`);
}

const INQUIRY_FIELDS =
  "id, guest_name, guest_email, check_in, check_out, status, assigned_to, created_at, property:properties(id, name, estate:estates(name))";

export type InquiryRow = {
  id: string;
  guest_name: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  status: InquiryStatus;
  assigned_to: string | null;
  created_at: string;
  property: { id: string; name: string; estate: { name: string } } | null;
};

// New and claimed inquiries, newest first, with the full count for the badge.
export async function openInquiries(supabase: UserClient, limit = 4): Promise<{ rows: InquiryRow[]; total: number }> {
  const { data, error, count } = await supabase
    .from("inquiries")
    .select(INQUIRY_FIELDS, { count: "exact" })
    .is("deleted_at", null)
    .in("status", ["new", "claimed"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) failed("inquiries");
  return { rows: data as unknown as InquiryRow[], total: count ?? 0 };
}

export type Activity = Pick<
  Row<"audit_log">,
  "id" | "action" | "entity_type" | "entity_id" | "actor_id" | "metadata" | "created_at"
>;

// Only the owner can read the audit log; anyone else gets an empty list from RLS.
export async function recentActivity(supabase: UserClient, limit = 5): Promise<Activity[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, action, entity_type, entity_id, actor_id, metadata, created_at")
    .not("action", "like", "login%")
    .not("action", "like", "logout%")
    .not("action", "like", "mfa%")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) failed("recent activity");
  return data;
}

export type InquiryFilters = {
  status?: InquiryStatus;
  property?: string;
  assignee?: string;
  from?: string;
  to?: string;
  q?: string;
};

export const PAGE_SIZE = 25;

// SAST midnight, as an instant the database can compare
const sastStart = (isoDate: string) => `${isoDate}T00:00:00+02:00`;

export async function listInquiries(
  supabase: UserClient,
  filters: InquiryFilters,
  page: number,
): Promise<{ rows: InquiryRow[]; total: number }> {
  let query = supabase
    .from("inquiries")
    .select(INQUIRY_FIELDS, { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.property) query = query.eq("property_id", filters.property);
  if (filters.assignee === "unassigned") query = query.is("assigned_to", null);
  else if (filters.assignee) query = query.eq("assigned_to", filters.assignee);
  if (filters.from) query = query.gte("created_at", sastStart(filters.from));
  if (filters.to) query = query.lt("created_at", sastStart(addDays(filters.to, 1)));
  if (filters.q) {
    // characters that would change the meaning of the PostgREST filter are dropped
    const term = filters.q.replace(/[,()*%\\]/g, " ").trim();
    if (term) query = query.or(`guest_name.ilike.*${term}*,guest_email.ilike.*${term}*`);
  }
  const { data, error, count } = await query;
  if (error) failed("inquiries");
  return { rows: data as unknown as InquiryRow[], total: count ?? 0 };
}

export async function getInquiry(supabase: UserClient, id: string) {
  const { data, error } = await supabase
    .from("inquiries")
    .select("*, property:properties(id, name, slug, is_published, estate:estates(name))")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) failed("the inquiry");
  return data;
}

export type Admin = { id: string; full_name: string };

export async function activeAdmins(supabase: UserClient): Promise<Admin[]> {
  const { data, error } = await supabase.rpc("list_active_admins");
  if (error) failed("the team");
  return data;
}

type AdminProperty = { id: string; name: string; is_published: boolean };

export async function adminProperties(supabase: UserClient): Promise<AdminProperty[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("id, name, is_published")
    .is("deleted_at", null)
    .order("name");
  if (error) failed("properties");
  return data;
}

// "propertyId|date" for every blocked night in the range
export async function blockedNights(supabase: UserClient, from: string, to: string, propertyId?: string) {
  let query = supabase.from("availability_blocks").select("property_id, date").gte("date", from).lte("date", to);
  if (propertyId) query = query.eq("property_id", propertyId);
  const { data, error } = await query;
  if (error) failed("availability");
  return data.map((b) => `${b.property_id}|${b.date}`);
}

type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

export type RegionWithEstates = Row<"regions"> & { estates: Row<"estates">[] };

export async function regionsWithEstates(supabase: UserClient): Promise<RegionWithEstates[]> {
  const { data, error } = await supabase
    .from("regions")
    .select("*, estates(*)")
    .order("sort_order")
    .order("name")
    .order("sort_order", { referencedTable: "estates" })
    .order("name", { referencedTable: "estates" });
  if (error) failed("regions");
  return data;
}

export type PropertyListRow = Pick<
  Row<"properties">,
  | "id"
  | "estate_id"
  | "name"
  | "slug"
  | "is_published"
  | "is_halal"
  | "max_guests"
  | "price_from_zar"
  | "property_type"
  | "updated_at"
> & { estate: { name: string; region: { name: string } }; photos: { thumb_path: string; is_cover: boolean }[] };

export async function listPropertiesAdmin(supabase: UserClient): Promise<PropertyListRow[]> {
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, estate_id, name, slug, is_published, is_halal, max_guests, price_from_zar, property_type, updated_at, estate:estates!inner(name, region:regions!inner(name)), photos:property_photos(thumb_path, is_cover)",
    )
    .is("deleted_at", null)
    .order("name");
  if (error) failed("homes");
  return data;
}

export type PropertyPhoto = Pick<
  Row<"property_photos">,
  "id" | "storage_path" | "thumb_path" | "alt_text" | "sort_order" | "is_cover" | "width" | "height"
>;

type PropertyForEdit = Row<"properties"> & { photos: PropertyPhoto[] };

export async function getPropertyAdmin(supabase: UserClient, id: string): Promise<PropertyForEdit | null> {
  const { data, error } = await supabase
    .from("properties")
    .select("*, photos:property_photos(id, storage_path, thumb_path, alt_text, sort_order, is_cover, width, height)")
    .eq("id", id)
    .is("deleted_at", null)
    .order("sort_order", { referencedTable: "property_photos" })
    .maybeSingle();
  if (error) failed("home");
  return data;
}

export type PostListRow = Pick<
  Row<"blog_posts">,
  "id" | "title" | "slug" | "is_published" | "published_at" | "updated_at"
>;

export async function listPostsAdmin(supabase: UserClient): Promise<PostListRow[]> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("id, title, slug, is_published, published_at, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) failed("journal posts");
  return data;
}

export async function getPostAdmin(supabase: UserClient, id: string): Promise<Row<"blog_posts"> | null> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) failed("journal post");
  return data;
}

export async function listTestimonialsAdmin(supabase: UserClient): Promise<Row<"testimonials">[]> {
  const { data, error } = await supabase
    .from("testimonials")
    .select("*")
    .order("sort_order")
    .order("created_at", { ascending: false });
  if (error) failed("testimonials");
  return data;
}
