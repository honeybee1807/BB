import "server-only";
import { addDays, todayInSast } from "@/lib/format";
import { openRate, type InquiryStatus } from "@/lib/admin-format";
import type { createClient } from "@/lib/supabase/server";

// Every read uses the signed-in user's session, so RLS decides what they see.
type UserClient = Awaited<ReturnType<typeof createClient>>;

function failed(what: string): never {
  throw new Error(`Could not load ${what}`);
}

const INQUIRY_FIELDS =
  "id, guest_name, guest_email, check_in, check_out, status, assigned_to, created_at, property:properties(id, name, estate:estates(name), photos:property_photos(thumb_path, is_cover))";

export type InquiryRow = {
  id: string;
  guest_name: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  status: InquiryStatus;
  assigned_to: string | null;
  created_at: string;
  property: { id: string; name: string; estate: { name: string }; thumb: string | null } | null;
};

type RawInquiry = Omit<InquiryRow, "property"> & {
  property: {
    id: string;
    name: string;
    estate: { name: string };
    photos: { thumb_path: string; is_cover: boolean }[];
  } | null;
};

function toRow({ property, ...rest }: RawInquiry): InquiryRow {
  return {
    ...rest,
    property: property && {
      id: property.id,
      name: property.name,
      estate: property.estate,
      thumb: property.photos.find((p) => p.is_cover)?.thumb_path ?? null,
    },
  };
}

export async function recentInquiries(supabase: UserClient, limit = 5): Promise<InquiryRow[]> {
  const { data, error } = await supabase
    .from("inquiries")
    .select(INQUIRY_FIELDS)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) failed("inquiries");
  return (data as unknown as RawInquiry[]).map(toRow);
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
  return { rows: (data as unknown as RawInquiry[]).map(toRow), total: count ?? 0 };
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

export type AdminProperty = { id: string; name: string; is_published: boolean };

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

export type DashboardCounts = {
  total: [number, number];
  answered: [number, number];
  fresh: [number, number];
  rate: [number | null, number | null];
};

const monthStart = (isoDate: string) => `${isoDate.slice(0, 7)}-01`;

export async function dashboardCounts(supabase: UserClient): Promise<DashboardCounts> {
  const today = todayInSast();
  const thisMonth = monthStart(today);
  const lastMonth = monthStart(addDays(thisMonth, -1));
  const nextMonth = monthStart(addDays(thisMonth, 32));

  const count = async (from: string, to: string, statuses?: InquiryStatus[]) => {
    let q = supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .gte("created_at", sastStart(from))
      .lt("created_at", sastStart(to));
    if (statuses) q = q.in("status", statuses);
    const { count: n, error } = await q;
    if (error) failed("inquiry counts");
    return n ?? 0;
  };

  const { data: published, error: pubError } = await supabase
    .from("properties")
    .select("id")
    .eq("is_published", true)
    .is("deleted_at", null);
  if (pubError) failed("properties");
  const ids = published.map((p) => p.id);

  const blocked = async (from: string, to: string) => {
    if (ids.length === 0) return 0;
    const { count: n, error } = await supabase
      .from("availability_blocks")
      .select("date", { count: "exact", head: true })
      .in("property_id", ids)
      .gte("date", from)
      .lte("date", to);
    if (error) failed("availability");
    return n ?? 0;
  };
  const nights = ids.length * 30;
  const rate = async (from: string, to: string) => openRate(nights, await blocked(from, to));

  // Closing usually follows an answer, so closed inquiries still count as answered.
  const done: InquiryStatus[] = ["answered", "closed"];
  const [t1, t0, a1, a0, f1, f0, r1, r0] = await Promise.all([
    count(thisMonth, nextMonth),
    count(lastMonth, thisMonth),
    count(thisMonth, nextMonth, done),
    count(lastMonth, thisMonth, done),
    count(thisMonth, nextMonth, ["new"]),
    count(lastMonth, thisMonth, ["new"]),
    rate(today, addDays(today, 29)),
    rate(addDays(today, -30), addDays(today, -1)),
  ]);
  return { total: [t1, t0], answered: [a1, a0], fresh: [f1, f0], rate: [r1, r0] };
}
