import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { addDays, todayInSast } from "../src/lib/format";
import { admin, cleanup, run, trackIp, uniqueIp } from "./support";

test.describe.configure({ mode: "serial" });

const folder = `e2e-${run}`;
const ids = { region: "", estate: "", halal: "", plain: "", draft: "" };
const slug = (s: string) => `${s}-${run}`;

async function photo(name: string, colour: string): Promise<string> {
  const body = await sharp({ create: { width: 640, height: 400, channels: 3, background: colour } })
    .webp()
    .toBuffer();
  const path = `${folder}/${name}.webp`;
  const { error } = await admin.storage.from("property-photos").upload(path, body, { contentType: "image/webp" });
  if (error) throw new Error(`upload ${name}: ${error.message}`);
  return path;
}

async function addProperty(fields: Record<string, unknown>, colour: string): Promise<string> {
  const { data, error } = await admin
    .from("properties")
    .insert({ estate_id: ids.estate, ...fields } as never)
    .select("id")
    .single();
  if (error || !data) throw new Error(`property: ${error?.message}`);
  const path = await photo(String(fields.slug), colour);
  const { error: pErr } = await admin.from("property_photos").insert({
    property_id: data.id,
    storage_path: path,
    thumb_path: path,
    alt_text: "",
    is_cover: true,
    width: 640,
    height: 400,
  });
  if (pErr) throw new Error(`photo: ${pErr.message}`);
  return data.id;
}

test.beforeAll(async () => {
  const { data: region, error: rErr } = await admin
    .from("regions")
    .insert({ slug: slug("test-region"), name: `Test Region ${run}`, description: "Mountains and rivers." })
    .select("id")
    .single();
  if (rErr || !region) throw new Error(`region: ${rErr?.message}`);
  ids.region = region.id;
  const { data: estate, error: eErr } = await admin
    .from("estates")
    .insert({ region_id: ids.region, slug: slug("test-estate"), name: `Test Estate ${run}` })
    .select("id")
    .single();
  if (eErr || !estate) throw new Error(`estate: ${eErr?.message}`);
  ids.estate = estate.id;

  ids.halal = await addProperty(
    {
      slug: slug("halal-home"),
      name: `Halal Home ${run}`,
      summary: "A quiet family home.",
      max_guests: 8,
      bedrooms: 4,
      bathrooms: 3,
      price_from_zar: 1800,
      is_halal: true,
      halal_details: "Alcohol-free premises and a separate kitchen.",
      custom_fields: [{ label: "Check-in", value: "From 14:00" }],
      is_featured: true,
      is_published: true,
    },
    "#0b2a3d",
  );
  ids.plain = await addProperty(
    { slug: slug("plain-home"), name: `Plain Home ${run}`, is_halal: false, is_published: true },
    "#e8cb9c",
  );
  ids.draft = await addProperty(
    { slug: slug("draft-home"), name: `Draft Home ${run}`, is_published: false },
    "#0f5a57",
  );
});

test.afterAll(async () => {
  await admin.from("inquiries").delete().in("property_id", [ids.halal, ids.plain]);
  await admin.from("properties").delete().in("id", [ids.halal, ids.plain, ids.draft]);
  await admin.from("estates").delete().eq("id", ids.estate);
  await admin.from("regions").delete().eq("id", ids.region);
  const { data: files } = await admin.storage.from("property-photos").list(folder);
  if (files?.length) await admin.storage.from("property-photos").remove(files.map((f) => `${folder}/${f.name}`));
  await cleanup();
});

// no-cache makes the dev server skip "use cache", so fixture rows show straight away
test.beforeEach(async ({ page }) => {
  const ip = uniqueIp();
  trackIp(ip);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ip, "cache-control": "no-cache" });
});

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test("homepage shows the hero, the form and a featured halal home", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Coast to\s*mountain\./i);
  await expect(page.getByRole("heading", { name: "Inquiry form" })).toBeVisible();
  const card = page.getByRole("link", { name: new RegExp(`Halal Home ${run}`) });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Halal accommodation");
  await expect(card).toContainText("From R1,800 / night");
  await expect(page.getByRole("link", { name: new RegExp(`Draft Home ${run}`) })).toHaveCount(0);
  await expectNoA11yViolations(page);
});

test("property page has breadcrumbs, halal details and a preselected inquiry", async ({ page }) => {
  await page.goto(`/properties/${slug("halal-home")}`);
  await expect(page.getByRole("heading", { level: 1, name: `Halal Home ${run}` })).toBeVisible();
  const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(crumbs.getByRole("link", { name: `Test Region ${run}` })).toBeVisible();
  await expect(crumbs.getByRole("link", { name: `Test Estate ${run}` })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Halal details" })).toBeVisible();
  await expect(page.getByText("Alcohol-free premises and a separate kitchen.")).toBeVisible();
  await expect(page.getByText("From 14:00")).toBeVisible();
  await expect(page.getByText(`Inquiring about Halal Home ${run}`)).toBeVisible();
  await expectNoA11yViolations(page);
});

test("an unpublished property is not found", async ({ page }) => {
  await page.goto(`/properties/${slug("draft-home")}`);
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
});

test("filters the list to halal accommodation", async ({ page }) => {
  await page.goto(`/properties?region=${slug("test-region")}`);
  await expect(page.getByRole("link", { name: new RegExp(`Plain Home ${run}`) })).toBeVisible();
  await page.getByLabel("Halal accommodation only").check();
  await page.getByRole("button", { name: "Show homes" }).click();
  await expect(page).toHaveURL(/halal=1/);
  await expect(page.getByRole("link", { name: new RegExp(`Halal Home ${run}`) })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`Plain Home ${run}`) })).toHaveCount(0);
});

test("region and estate pages list their homes", async ({ page }) => {
  await page.goto(`/regions/${slug("test-region")}`);
  await expect(page.getByRole("heading", { level: 1, name: `Test Region ${run}` })).toBeVisible();
  const estates = page.getByRole("region", { name: "Estates" });
  await estates.getByRole("link", { name: new RegExp(`Test Estate ${run}`) }).click();
  await expect(page.getByRole("heading", { level: 1, name: `Test Estate ${run}` })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`Halal Home ${run}`) })).toBeVisible();
});

test("the inquiry form shows errors, then sends", async ({ page }) => {
  await page.goto(`/properties/${slug("halal-home")}`);
  const form = page.getByRole("region", { name: "Inquiry form" });
  await form.getByRole("button", { name: "Send inquiry" }).click();
  const name = form.getByLabel("Full name");
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(form.getByText("Please enter your full name.")).toBeVisible();
  await expect(form.getByText("Please agree so we can contact you about your stay.")).toBeVisible();

  const checkIn = addDays(todayInSast(), 20);
  await name.fill("Test Guest");
  await form.getByLabel("Email address").fill(`e2e-form-${run}@test.local`);
  await form.getByLabel("Phone number").fill("082 123 4567");
  await form.getByLabel("Check-in date").fill(checkIn);
  await form.getByLabel("Check-out date").fill(addDays(checkIn, 2));
  await form.getByLabel(/I agree/).check();
  // Cloudflare's test key passes on its own
  await expect
    .poll(() => page.evaluate(() => document.querySelector<HTMLInputElement>("[name=cf-turnstile-response]")?.value))
    .toBeTruthy();
  await form.getByRole("button", { name: "Send inquiry" }).click();

  await expect(form.getByRole("status")).toContainText("Thank you");
  await expect(form.getByRole("status")).toBeFocused();
  await expect(form.getByText("Test Guest")).toHaveCount(0);
  const { data } = await admin.from("inquiries").select("property_id").eq("guest_email", `e2e-form-${run}@test.local`);
  expect(data).toEqual([{ property_id: ids.halal }]);
});

test("the mobile menu opens and closes with Escape", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await page.goto("/");
  const button = page.getByRole("button", { name: "Menu" });
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Properties" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(button).toBeFocused();
});

test("never renders an empty or contact link while details are missing", async ({ page }) => {
  for (const path of ["/", "/contact", "/about"]) {
    await page.goto(path);
    await expect(page.locator('a[href=""], a:not([href])')).toHaveCount(0);
    await expect(page.locator('a[href^="tel:"], a[href^="mailto:"], a[href*="wa.me"]')).toHaveCount(0);
  }
  await expect(page.getByRole("heading", { name: "Other ways to reach us" })).toHaveCount(0);
});

test("about and privacy are marked as drafts", async ({ page }) => {
  for (const path of ["/about", "/privacy"]) {
    await page.goto(path);
    await expect(page.getByRole("note")).toContainText("waiting for approval and is not final");
  }
  await expect(page.getByText("12 months")).toBeVisible();
});

test("the logo is the share image and appears on the admin login", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/images\/share\.jpg$/);
  await page.goto("/admin/login");
  await expect(page.getByRole("img", { name: "Bargain Breaks" })).toBeVisible();
});
