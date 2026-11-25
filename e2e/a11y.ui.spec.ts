// Accessibility checks on every public page type and the main admin pages, on desktop and a phone.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { totpCode } from "../tests/api/totp";
import { admin, apiAs, cleanup, createUser, password, type TestUser } from "./support";

test.describe.configure({ mode: "serial", timeout: 300_000 });

let owner: TestUser;
let storageState: Awaited<ReturnType<Awaited<ReturnType<typeof apiAs>>["storageState"]>>;
const paths = { property: "", region: "", estate: "", post: "", homeId: "", postId: "", inquiryId: "" };

async function axe(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("load");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test.beforeAll(async () => {
  owner = await createUser("a11y-owner", { role: "owner", fullName: "Access Owner" });
  const api = await apiAs();
  expect((await api.post("/api/admin/login", { data: { email: owner.email, password } })).status()).toBe(200);
  const mfa = (await (await api.post("/api/admin/mfa/enroll", { data: {} })).json()) as {
    factorId: string;
    secret: string;
  };
  await api.post("/api/admin/mfa/verify", { data: { factorId: mfa.factorId, code: totpCode(mfa.secret) } });
  storageState = await api.storageState();

  const { data: home } = await admin
    .from("properties")
    .select("id, slug, estate:estates!inner(slug, region:regions!inner(slug))")
    .eq("is_published", true)
    .is("deleted_at", null)
    .limit(1)
    .single();
  const { data: post } = await admin
    .from("blog_posts")
    .select("id, slug")
    .eq("is_published", true)
    .is("deleted_at", null)
    .limit(1)
    .single();
  const { data: inquiry } = await admin.from("inquiries").select("id").is("deleted_at", null).limit(1).maybeSingle();
  const estate = home!.estate as unknown as { slug: string; region: { slug: string } };
  Object.assign(paths, {
    property: home!.slug,
    homeId: home!.id,
    region: estate.region.slug,
    estate: estate.slug,
    post: post!.slug,
    postId: post!.id,
    inquiryId: inquiry?.id ?? "",
  });
});

test.afterAll(cleanup);

test("public pages have no accessibility violations", async ({ page }) => {
  const found: string[] = [];
  for (const path of [
    "/",
    "/properties",
    "/properties?halal=1",
    `/properties/${paths.property}`,
    `/regions/${paths.region}`,
    `/regions/${paths.region}/${paths.estate}`,
    "/journal",
    `/journal/${paths.post}`,
    "/about",
    "/contact",
    "/privacy",
    "/no-such-page",
    "/admin/login",
  ]) {
    found.push(...(await axe(page, path)));
  }
  expect(found).toEqual([]);
});

test("admin pages have no accessibility violations", async ({ browser }) => {
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();
  const found: string[] = [];
  for (const path of [
    "/admin",
    "/admin/properties",
    `/admin/properties/${paths.homeId}`,
    "/admin/properties/new",
    "/admin/availability",
    "/admin/inquiries",
    ...(paths.inquiryId ? [`/admin/inquiries?view=${paths.inquiryId}`] : []),
    "/admin/journal",
    `/admin/journal/${paths.postId}`,
    "/admin/team",
  ]) {
    found.push(...(await axe(page, path)));
  }
  await page.goto(`/admin/properties/${paths.homeId}`);
  await page.getByRole("button", { name: "Delete home" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const dialog = await new AxeBuilder({ page }).include("[role=dialog]").analyze();
  found.push(...dialog.violations.map((v) => `delete dialog ${v.id}`));
  expect(found).toEqual([]);
  await context.close();
});

test("the skip link is the first stop and moves focus to the content", async ({ page }) => {
  for (const path of ["/", `/properties/${paths.property}`]) {
    await page.goto(path);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
  }
});

test("the delete dialog keeps focus inside and gives it back on close", async ({ browser }) => {
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();
  await page.goto(`/admin/properties/${paths.homeId}`);
  const trigger = page.getByRole("button", { name: "Delete home" });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await context.close();
});
