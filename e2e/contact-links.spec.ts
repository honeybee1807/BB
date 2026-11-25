// With no contact details set (as in src/lib/site.ts today), no page may show a contact link.
import { expect, test } from "@playwright/test";
import { contactLinks } from "../src/lib/site";
import { admin } from "./support";

test.skip(contactLinks().length > 0, "contact details are set");
test.describe.configure({ timeout: 180_000 });

test("no page links to an empty phone, email or WhatsApp", async ({ request }) => {
  const { data: home } = await admin
    .from("properties")
    .select("slug, estate:estates!inner(slug, region:regions!inner(slug))")
    .eq("is_published", true)
    .is("deleted_at", null)
    .limit(1)
    .single();
  const { data: post } = await admin
    .from("blog_posts")
    .select("slug")
    .eq("is_published", true)
    .is("deleted_at", null)
    .limit(1)
    .single();
  const estate = home!.estate as unknown as { slug: string; region: { slug: string } };
  const pages = [
    "/",
    "/properties",
    `/properties/${home!.slug}`,
    `/regions/${estate.region.slug}`,
    `/regions/${estate.region.slug}/${estate.slug}`,
    "/journal",
    `/journal/${post!.slug}`,
    "/about",
    "/contact",
    "/privacy",
    "/no-such-page",
    "/admin/login",
  ];

  for (const path of pages) {
    const html = await (await request.get(path)).text();
    expect(html, path).not.toMatch(/href="(tel|mailto):/);
    expect(html, path).not.toContain("wa.me/");
    expect(html, path).not.toContain('"telephone"');
    expect(html, path).not.toContain("Other ways to reach us");
    expect(html, path).not.toContain("Need help?");
  }
});
