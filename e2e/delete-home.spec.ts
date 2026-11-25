// Deleting a home, run against the local dev server and Supabase stack.
import { expect, test, type APIRequestContext } from "@playwright/test";
import { totpCode } from "../tests/api/totp";
import { admin, apiAs, auditRows, cleanup, createUser, password, run, type TestUser } from "./support";

test.describe.configure({ mode: "serial", timeout: 120_000 });

let owner: TestUser;
let team: TestUser;
let ownerApi: APIRequestContext;
let estateId = "";

async function signIn(email: string, enrol = false): Promise<APIRequestContext> {
  const api = await apiAs();
  expect((await api.post("/api/admin/login", { data: { email, password } })).status()).toBe(200);
  if (enrol) {
    const mfa = (await (await api.post("/api/admin/mfa/enroll", { data: {} })).json()) as {
      factorId: string;
      secret: string;
    };
    await api.post("/api/admin/mfa/verify", { data: { factorId: mfa.factorId, code: totpCode(mfa.secret) } });
  }
  return api;
}

async function addHome(slug: string) {
  const { data } = await admin
    .from("properties")
    .insert({ name: `Delete Test ${slug}`, slug, estate_id: estateId, is_published: true })
    .select("id")
    .single();
  return data!.id;
}

const deletedAt = async (id: string) =>
  (await admin.from("properties").select("deleted_at").eq("id", id).single()).data?.deleted_at;

test.beforeAll(async () => {
  owner = await createUser("delete-owner", { role: "owner", fullName: "Delete Owner" });
  team = await createUser("delete-team", { role: "team_member", fullName: "Delete Team" });
  ownerApi = await signIn(owner.email, true);
  estateId = (await admin.from("estates").select("id").limit(1).single()).data!.id;
});

test.afterAll(async () => {
  await admin.from("properties").delete().like("slug", `e2e-delete-${run}%`);
  await cleanup();
});

test("a team member cannot delete a home", async () => {
  const id = await addHome(`e2e-delete-${run}-team`);
  const api = await signIn(team.email);
  expect((await api.delete(`/api/admin/properties/${id}`)).status()).toBe(404);
  expect(await deletedAt(id)).toBeNull();
  const page = await api.get(`/admin/properties/${id}`);
  expect(await page.text()).not.toContain("Delete this home");
});

test("the owner deletes a home and it leaves the website", async () => {
  const slug = `e2e-delete-${run}-api`;
  const id = await addHome(slug);
  const res = await ownerApi.delete(`/api/admin/properties/${id}`);
  expect(res.status(), await res.text()).toBe(200);
  expect(await deletedAt(id)).not.toBeNull();
  expect(await auditRows({ actorId: owner.id, action: "property.delete" })).toBeGreaterThan(0);
  expect((await (await apiAs()).get(`/properties/${slug}`)).status()).toBe(404);
  expect((await ownerApi.delete(`/api/admin/properties/${id}`)).status()).toBe(404);
});

test("the owner confirms in a dialog before the home is deleted", async ({ browser }) => {
  const id = await addHome(`e2e-delete-${run}-ui`);
  const context = await browser.newContext({ storageState: await ownerApi.storageState() });
  const page = await context.newPage();
  await page.goto(`/admin/properties/${id}`);
  await page.getByRole("button", { name: "Delete home" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /^Delete Delete Test/ })).toBeVisible();
  await dialog.getByRole("button", { name: "Keep it" }).click();
  await expect(dialog).toBeHidden();
  expect(await deletedAt(id)).toBeNull();

  await page.getByRole("button", { name: "Delete home" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Yes, delete it" }).click();
  await page.waitForURL(/\/admin\/properties$/);
  expect(await deletedAt(id)).not.toBeNull();
  await context.close();
});
