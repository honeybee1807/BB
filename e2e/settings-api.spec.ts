// Page SEO settings routes, run against the local dev server and Supabase stack.
import { expect, test, type APIRequestContext } from "@playwright/test";
import { totpCode } from "../tests/api/totp";
import { admin, apiAs, auditRows, cleanup, createUser, password, type TestUser } from "./support";

test.describe.configure({ mode: "serial" });

const PAGE = "/contact";
let owner: TestUser;
let team: TestUser;
let ownerApi: APIRequestContext;
let saved: { title: string | null; description: string | null } | null = null;

async function signIn(email: string): Promise<APIRequestContext> {
  const api = await apiAs();
  expect((await api.post("/api/admin/login", { data: { email, password } })).status()).toBe(200);
  return api;
}

const save = (api: APIRequestContext, data: Record<string, unknown>) => api.put("/api/admin/settings/seo", { data });

test.beforeAll(async () => {
  owner = await createUser("seo-owner", { role: "owner", fullName: "Seo Owner" });
  team = await createUser("seo-team", { role: "team_member", fullName: "Seo Team" });
  ownerApi = await signIn(owner.email);
  const enrol = (await (await ownerApi.post("/api/admin/mfa/enroll", { data: {} })).json()) as {
    factorId: string;
    secret: string;
  };
  await ownerApi.post("/api/admin/mfa/verify", { data: { factorId: enrol.factorId, code: totpCode(enrol.secret) } });
  const { data } = await admin.from("seo_pages").select("title, description").eq("path", PAGE).maybeSingle();
  saved = data;
});

test.afterAll(async () => {
  if (saved) await admin.from("seo_pages").update(saved).eq("path", PAGE);
  await cleanup();
});

test("a team member cannot open Settings or change page SEO", async () => {
  const api = await signIn(team.email);
  expect((await api.get("/admin/settings")).status()).toBe(404);
  expect((await save(api, { page: PAGE, title: "Team title", description: "" })).status()).toBe(404);
  expect((await api.put("/api/admin/settings/seo/image", { data: { page: PAGE, path: null } })).status()).toBe(404);
  const { data } = await admin.from("seo_pages").select("title").eq("path", PAGE).single();
  expect(data?.title).not.toBe("Team title");
});

test("signed out, the routes ask for a session", async () => {
  const api = await apiAs();
  expect((await save(api, { page: PAGE, title: "x", description: "x" })).status()).toBe(401);
});

test("only the Settings pages and known fields are accepted", async () => {
  expect((await save(ownerApi, { page: "/admin", title: "x", description: "x" })).status()).toBe(400);
  expect((await save(ownerApi, { page: PAGE, title: "x", description: "x", updated_by: team.id })).status()).toBe(400);
  expect((await save(ownerApi, { page: PAGE, title: "a".repeat(121), description: "" })).status()).toBe(400);
});

test("the owner's change is cleaned, recorded and shown on the page", async () => {
  // load once so the page is cached, then check the save refreshes it
  const before = await (await apiAs()).get(PAGE);
  expect(await before.text()).not.toContain("Talk to Naseema about your stay");

  const res = await save(ownerApi, {
    page: PAGE,
    title: "  Talk to Naseema\u0000 about   your stay ",
    description: "",
  });
  expect(res.status(), await res.text()).toBe(200);

  const { data } = await admin.from("seo_pages").select("title, description, updated_by").eq("path", PAGE).single();
  expect(data).toEqual({ title: "Talk to Naseema about your stay", description: null, updated_by: owner.id });
  expect(await auditRows({ actorId: owner.id, action: "seo.update" })).toBe(1);

  const html = await (await (await apiAs()).get(PAGE)).text();
  expect(html).toContain("<title>Talk to Naseema about your stay</title>");
  // the blank description falls back to the default
  expect(html).toContain('name="description" content="Send us an inquiry about halal accommodation');
});

test("clearing the title brings back the default", async () => {
  expect((await save(ownerApi, { page: PAGE, title: "", description: "" })).status()).toBe(200);
  const html = await (await (await apiAs()).get(PAGE)).text();
  expect(html).toContain("<title>Contact Us | Bargain Breaks</title>");
});
