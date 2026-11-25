import AxeBuilder from "@axe-core/playwright";
import { expect as baseExpect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { slugify } from "../src/lib/slug";
import { totpCode } from "../tests/api/totp";
import { admin, cleanup, createUser, password, run, trackIp, uniqueIp, type TestUser } from "./support";

// Each step saves through the dev server, which can be slow to compile a route the first time.
test.describe.configure({ mode: "serial", timeout: 180_000 });
const expect = baseExpect.configure({ timeout: 30_000 });

let owner: TestUser;
let tag = "";
const names = () => ({
  region: `E2E Region ${tag}`,
  estate: `E2E Estate ${tag}`,
  home: `E2E Home ${tag}`,
  post: `E2E Post ${tag}`,
  guest: `E2E Guest ${tag}`,
});

test.beforeAll(async ({}, testInfo) => {
  tag = `${run}${testInfo.project.name.slice(0, 1)}`;
  owner = await createUser(`content-owner-${tag}`, { role: "owner", fullName: "Content Owner" });
});

test.afterAll(async () => {
  const n = names();
  const { data: homes } = await admin.from("properties").select("id").eq("slug", slugify(n.home));
  for (const h of homes ?? []) {
    const { data: files } = await admin.storage.from("property-photos").list(h.id);
    if (files?.length) await admin.storage.from("property-photos").remove(files.map((f) => `${h.id}/${f.name}`));
    await admin.from("properties").delete().eq("id", h.id);
  }
  await admin.from("estates").delete().eq("slug", slugify(n.estate));
  await admin.from("regions").delete().eq("slug", slugify(n.region));
  await admin.from("blog_posts").delete().eq("slug", slugify(n.post));
  await admin.from("testimonials").delete().eq("guest_name", n.guest);
  await cleanup();
});

test.beforeEach(async ({ page }) => {
  const ip = uniqueIp();
  trackIp(ip);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ip, "cache-control": "no-cache" });
});

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

let secret = "";

async function signInAsOwner(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(owner.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin\/(mfa)?$/);
  if (page.url().endsWith("/mfa")) {
    if (!secret) {
      await page.getByRole("button", { name: "Set up two-factor sign-in" }).click();
      secret = ((await page.locator("p", { hasText: "setup key" }).locator("code").textContent()) ?? "").trim();
    }
    await page.getByLabel("Authentication code").fill(totpCode(secret));
    await page.getByRole("button", { name: "Verify" }).click();
    await page.waitForURL(/\/admin$/);
  }
}

test("owner adds a region and an estate", async ({ page }) => {
  const n = names();
  await signInAsOwner(page);
  // the old address now leads to the Regions & estates section of Properties
  await page.goto("/admin/regions");
  await expect(page).toHaveURL(/\/admin\/properties#regions$/);
  await page.getByText("Add a region", { exact: true }).click();
  const addRegion = page.locator("details").filter({ has: page.getByText("Add a region", { exact: true }) });
  await addRegion.getByLabel("Name").fill(n.region);
  await addRegion.getByRole("button", { name: "Add region" }).click();
  await expect(addRegion.getByText("Region added.")).toBeVisible();

  const region = page.getByRole("region", { name: n.region });
  await region.getByText(`Add an estate to ${n.region}`).click();
  await region.getByLabel("Name").last().fill(n.estate);
  await region.getByRole("button", { name: "Add estate" }).click();
  await expect(region.getByText("Estate added.")).toBeVisible();
  await expect(region.locator("summary", { hasText: n.estate })).toBeVisible();
  await expectNoA11yViolations(page);
});

test("owner adds a halal home with a photo and publishes it", async ({ page }) => {
  const n = names();
  await signInAsOwner(page);
  await page.goto("/admin/properties/new");
  await page.getByLabel("Name").fill(n.home);
  await page.getByLabel("Estate").selectOption({ label: n.estate });
  await page.getByLabel("Guests").fill("6");
  await page.getByLabel("Published").check();
  await page.getByRole("button", { name: "Create home" }).click();
  await page.waitForURL(/\/admin\/properties\/[0-9a-f-]{36}$/);

  const jpeg = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#2f6f8f" } })
    .jpeg()
    .toBuffer();
  await page.getByLabel("Add photos").setInputFiles({ name: "lounge.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await expect(page.getByText("1 photo added.")).toBeVisible();
  await expect(page.getByText("Cover", { exact: true })).toBeVisible();
  await page.getByLabel(/Description for screen readers/).fill("Lounge with sea views");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Description saved.")).toBeVisible();
  await expectNoA11yViolations(page);

  await page.goto(`/properties/${slugify(n.home)}`);
  await expect(page.getByRole("heading", { level: 1, name: n.home })).toBeVisible();
  await expect(page.locator('img[alt="Lounge with sea views"]').first()).toBeVisible();
});

test("a file that is not an image is refused", async ({ page }) => {
  await signInAsOwner(page);
  const { data } = await admin.from("properties").select("id").eq("slug", slugify(names().home)).single();
  await page.goto(`/admin/properties/${data!.id}`);
  await page
    .getByLabel("Add photos")
    .setInputFiles({ name: "fake.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not an image") });
  await expect(page.getByText("Please choose a JPEG, PNG or WebP image.")).toBeVisible();
});

test("owner publishes a journal post and unsafe markup is not rendered", async ({ page }) => {
  const n = names();
  await signInAsOwner(page);
  await page.goto("/admin/journal/new");
  await page.getByLabel("Title", { exact: true }).fill(n.post);
  await page
    .getByRole("textbox", { name: "Post", exact: true })
    .fill("A calm week by the sea.\n\n<script>window.__bad = 1</script>\n\n[Click me](javascript:alert(1))");
  await page.getByLabel("Published").check();
  await page.getByRole("button", { name: "Create post" }).click();
  await page.waitForURL(/\/admin\/journal\/[0-9a-f-]{36}$/);

  await page.goto(`/journal/${slugify(n.post)}`);
  await expect(page.getByRole("heading", { level: 1, name: n.post })).toBeVisible();
  await expect(page.getByText("A calm week by the sea.")).toBeVisible();
  expect(await page.evaluate(() => (window as { __bad?: number }).__bad)).toBeUndefined();
  await expect(page.locator('a[href^="javascript"]')).toHaveCount(0);
});

test("a visible testimonial appears on the homepage", async ({ page }) => {
  const n = names();
  await signInAsOwner(page);
  await page.goto("/admin/testimonials");
  await expect(page).toHaveURL(/\/admin\/journal#testimonials$/);
  await page.getByText("Add a testimonial", { exact: true }).click();
  const add = page.locator("details").filter({ has: page.getByText("Add a testimonial", { exact: true }) });
  await add.getByLabel("Guest name").fill(n.guest);
  await add.getByLabel("What they said").fill("Spotless and peaceful.");
  await add.getByLabel("Show on the website").check();
  await add.getByRole("button", { name: "Add testimonial" }).click();
  await expect(add.getByText("Testimonial added.")).toBeVisible();
  await expectNoA11yViolations(page);

  await page.goto("/");
  await expect(page.getByText(n.guest)).toBeVisible();
});
