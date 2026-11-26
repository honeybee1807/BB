// Publishing, hiding, deleting and renaming must show on the public site at the next visit,
// including the status code. Runs against the dev server or a production build on :3000.
import { expect, test, type APIRequestContext } from "@playwright/test";
import { totpCode } from "../tests/api/totp";
import { admin, apiAs, cleanup, createUser, password, run } from "./support";

test.describe.configure({ mode: "serial", timeout: 120_000 });

const tag = `e2e-pub-${run}`;
let api: APIRequestContext;
let regionId = "";
let estateId = "";

async function call(method: "post" | "patch" | "delete", url: string, data?: object) {
  const res = await api[method](url, data ? { data } : {});
  expect(res.status(), `${method} ${url}: ${await res.text()}`).toBe(200);
  return (await res.json()) as { id?: string };
}

// A fresh visitor each time, so nothing is served from a cookie or an earlier response.
async function visit(path: string) {
  const res = await (await apiAs()).get(path);
  return { status: res.status(), text: await res.text() };
}

const region = (slug: string) => ({
  name: `Pub Region ${run}`,
  slug,
  description: null,
  sort_order: 0,
  seo_title: null,
  seo_description: null,
});

const home = (slug: string, is_published: boolean) => ({
  estate_id: estateId,
  name: `Pub Home ${run}`,
  slug,
  summary: null,
  description: null,
  property_type: "holiday_home",
  town: null,
  max_guests: 4,
  bedrooms: 2,
  bathrooms: 1,
  is_halal: true,
  halal_details: null,
  price_from_zar: null,
  is_featured: false,
  featured_sort_order: 0,
  is_published,
  instagram_video_url: null,
  custom_fields: [],
  seo_title: null,
  seo_description: null,
});

const post = (slug: string, is_published: boolean) => ({
  title: `Pub Post ${run}`,
  slug,
  excerpt: "A short test post.",
  body_md: "Some words.",
  is_published,
  seo_title: null,
  seo_description: null,
});

test.beforeAll(async () => {
  const owner = await createUser("pub-owner", { role: "owner", fullName: "Pub Owner" });
  api = await apiAs();
  expect((await api.post("/api/admin/login", { data: { email: owner.email, password } })).status()).toBe(200);
  const mfa = (await (await api.post("/api/admin/mfa/enroll", { data: {} })).json()) as {
    factorId: string;
    secret: string;
  };
  await api.post("/api/admin/mfa/verify", { data: { factorId: mfa.factorId, code: totpCode(mfa.secret) } });
  regionId = (await call("post", "/api/admin/regions", region(`${tag}-region`))).id!;
  estateId = (
    await call("post", "/api/admin/estates", {
      ...region(`${tag}-estate`),
      name: `Pub Estate ${run}`,
      region_id: regionId,
    })
  ).id!;
});

test.afterAll(async () => {
  await admin.from("properties").delete().like("slug", `${tag}%`);
  await admin.from("blog_posts").delete().like("slug", `${tag}%`);
  await admin.from("estates").delete().like("slug", `${tag}%`);
  await admin.from("regions").delete().like("slug", `${tag}%`);
  await cleanup();
});

test("a home shows, hides, moves and goes with the right status", async () => {
  const name = `Pub Home ${run}`;
  const slug = `${tag}-home`;
  const id = (await call("post", "/api/admin/properties", home(slug, false))).id!;
  // a visit before it goes live must not be remembered
  expect((await visit(`/properties/${slug}`)).status).toBe(404);

  await call("patch", `/api/admin/properties/${id}`, { is_published: true });
  const live = await visit(`/properties/${slug}`);
  expect(live.status).toBe(200);
  expect(live.text).toContain(name);
  expect((await visit("/properties")).text).toContain(name);
  expect((await visit(`/regions/${tag}-region/${tag}-estate`)).text).toContain(name);
  expect((await visit("/sitemap.xml")).text).toContain(`/properties/${slug}`);

  await call("patch", `/api/admin/properties/${id}`, { is_published: false });
  expect((await visit(`/properties/${slug}`)).status).toBe(404);
  expect((await visit("/properties")).text).not.toContain(name);
  expect((await visit("/sitemap.xml")).text).not.toContain(`/properties/${slug}`);

  const moved = `${tag}-home-moved`;
  await call("patch", `/api/admin/properties/${id}`, home(moved, true));
  expect((await visit(`/properties/${slug}`)).status).toBe(404);
  expect((await visit(`/properties/${moved}`)).status).toBe(200);
  const sitemap = (await visit("/sitemap.xml")).text;
  expect(sitemap).toContain(`/properties/${moved}`);
  expect(sitemap).not.toContain(`/properties/${slug}<`);

  await call("delete", `/api/admin/properties/${id}`);
  expect((await visit(`/properties/${moved}`)).status).toBe(404);
  expect((await visit("/properties")).text).not.toContain(name);
  expect((await visit(`/regions/${tag}-region/${tag}-estate`)).text).not.toContain(name);
});

test("a journal post shows, hides, moves and goes with the right status", async () => {
  const title = `Pub Post ${run}`;
  const slug = `${tag}-post`;
  const id = (await call("post", "/api/admin/posts", post(slug, false))).id!;
  expect((await visit(`/journal/${slug}`)).status).toBe(404);

  await call("patch", `/api/admin/posts/${id}`, { is_published: true });
  const live = await visit(`/journal/${slug}`);
  expect(live.status).toBe(200);
  expect(live.text).toContain(title);
  expect((await visit("/journal")).text).toContain(title);
  expect((await visit("/sitemap.xml")).text).toContain(`/journal/${slug}`);

  await call("patch", `/api/admin/posts/${id}`, { is_published: false });
  expect((await visit(`/journal/${slug}`)).status).toBe(404);
  expect((await visit("/sitemap.xml")).text).not.toContain(`/journal/${slug}`);

  const moved = `${tag}-post-moved`;
  await call("patch", `/api/admin/posts/${id}`, post(moved, true));
  expect((await visit(`/journal/${slug}`)).status).toBe(404);
  expect((await visit(`/journal/${moved}`)).status).toBe(200);

  await call("delete", `/api/admin/posts/${id}`);
  expect((await visit(`/journal/${moved}`)).status).toBe(404);
  expect((await visit("/sitemap.xml")).text).not.toContain(`/journal/${moved}`);
});

test("renaming or deleting a region or estate changes its address at once", async () => {
  const estate = `${tag}-estate`;
  expect((await visit(`/regions/${tag}-region/${estate}`)).status).toBe(200);
  const movedEstate = `${tag}-estate-moved`;
  await call("patch", `/api/admin/estates/${estateId}`, {
    ...region(movedEstate),
    name: `Pub Estate ${run}`,
    region_id: regionId,
  });
  expect((await visit(`/regions/${tag}-region/${estate}`)).status).toBe(404);
  expect((await visit(`/regions/${tag}-region/${movedEstate}`)).status).toBe(200);

  const movedRegion = `${tag}-region-moved`;
  await call("patch", `/api/admin/regions/${regionId}`, region(movedRegion));
  expect((await visit(`/regions/${tag}-region`)).status).toBe(404);
  const page = await visit(`/regions/${movedRegion}`);
  expect(page.status).toBe(200);
  expect(page.text).toContain(`/regions/${movedRegion}/${movedEstate}`);
  expect((await visit("/sitemap.xml")).text).toContain(`/regions/${movedRegion}/${movedEstate}`);

  // the deleted home still holds the estate, so a second, empty estate shows the delete
  const spare = `${tag}-estate-spare`;
  const spareId = (
    await call("post", "/api/admin/estates", { ...region(spare), name: `Spare ${run}`, region_id: regionId })
  ).id!;
  expect((await visit(`/regions/${movedRegion}/${spare}`)).status).toBe(200);
  await call("delete", `/api/admin/estates/${spareId}`);
  expect((await visit(`/regions/${movedRegion}/${spare}`)).status).toBe(404);
  expect((await visit(`/regions/${movedRegion}`)).text).not.toContain(`/regions/${movedRegion}/${spare}`);
});

test("deleting an empty region gives a 404 at once", async () => {
  const slug = `${tag}-lone`;
  const id = (await call("post", "/api/admin/regions", { ...region(slug), name: `Lone ${run}` })).id!;
  expect((await visit(`/regions/${slug}`)).status).toBe(200);
  await call("delete", `/api/admin/regions/${id}`);
  expect((await visit(`/regions/${slug}`)).status).toBe(404);
  expect((await visit("/sitemap.xml")).text).not.toContain(`/regions/${slug}<`);
});
