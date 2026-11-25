// Status codes for detail pages, run against the local dev server and Supabase stack.
import { expect, test } from "@playwright/test";
import { admin, run } from "./support";

const hidden = `e2e-hidden-home-${run}`;
let real: { property: string; post: string; region: string; estate: string };

test.beforeAll(async () => {
  const { data: home } = await admin
    .from("properties")
    .select("slug, estate_id, estate:estates!inner(slug, region:regions!inner(slug))")
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
  real = { property: home!.slug, post: post!.slug, region: estate.region.slug, estate: estate.slug };
  await admin.from("properties").insert({ name: "Hidden Home", slug: hidden, estate_id: home!.estate_id });
});

test.afterAll(async () => {
  await admin.from("properties").delete().eq("slug", hidden);
});

test("unknown detail addresses answer with a real 404", async ({ request }) => {
  for (const path of [
    `/properties/no-such-home-${run}`,
    `/journal/no-such-post-${run}`,
    `/regions/no-such-region-${run}`,
    `/regions/${real.region}/no-such-estate-${run}`,
    `/regions/${real.region}/${real.estate}/extra`,
    "/properties/Not_A_Slug",
  ]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(404);
    expect(await res.text(), path).toContain("find that page");
  }
});

test("an unpublished home is a 404 too", async ({ request }) => {
  expect((await request.get(`/properties/${hidden}`)).status()).toBe(404);
});

test("real detail pages still answer 200", async ({ request }) => {
  for (const path of [
    `/properties/${real.property}`,
    `/journal/${real.post}`,
    `/regions/${real.region}`,
    `/regions/${real.region}/${real.estate}`,
  ]) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
});
