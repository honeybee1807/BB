// Detail pages stream a prerendered shell before they can look anything up, which
// fixes the status at 200. The proxy calls this first so unknown addresses get a real 404.

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type Lookup = { table: "properties" | "blog_posts" | "regions" | "estates"; query: string };

// null means the address is not a detail page; "missing" means it cannot exist.
export function lookupFor(pathname: string): Lookup | "missing" | null {
  const parts = pathname.split("/").filter(Boolean);
  const [section, first, second, ...rest] = parts;
  const slug = (s: string | undefined) => (s && SLUG.test(s) ? encodeURIComponent(s) : null);

  if ((section === "properties" || section === "journal") && first !== undefined) {
    const s = slug(first);
    if (!s || second !== undefined) return "missing";
    // the anon policies already hide drafts and deleted rows
    return { table: section === "properties" ? "properties" : "blog_posts", query: `slug=eq.${s}` };
  }
  if (section === "regions" && first !== undefined) {
    const region = slug(first);
    if (!region || rest.length > 0) return "missing";
    if (second === undefined) return { table: "regions", query: `slug=eq.${region}` };
    const estate = slug(second);
    if (!estate) return "missing";
    return { table: "estates", query: `slug=eq.${estate}&regions.slug=eq.${region}` };
  }
  return null;
}

// Not memoised: the proxy runs apart from the admin routes, so nothing could clear a memo
// when a page is published or hidden, and a stale answer means a wrong 404 or 200.
// Unknown when the database cannot be reached, so an outage never turns every page into a 404.
export async function routeExists(lookup: Lookup): Promise<boolean | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const select = lookup.table === "estates" ? "id,regions!inner(slug)" : "id";
  try {
    const res = await fetch(`${url}/rest/v1/${lookup.table}?select=${select}&${lookup.query}&limit=1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return ((await res.json()) as unknown[]).length > 0;
  } catch {
    return null;
  }
}
