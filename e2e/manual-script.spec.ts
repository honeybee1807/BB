// The guide's manual test script, automated where a browser can stand in for a person.
// Browsing, the halal filter, inquiry errors and team member access are covered in the other specs.
import { expect, test, type APIRequestContext, type Browser } from "@playwright/test";
import { dateRangeLabel } from "../src/lib/admin-format";
import { addDays, todayInSast } from "../src/lib/format";
import { totpCode } from "../tests/api/totp";
import {
  admin,
  apiAs,
  auditRows,
  cleanup,
  createUser,
  password,
  run,
  trackIp,
  uniqueIp,
  type TestUser,
} from "./support";

test.describe.configure({ mode: "serial", timeout: 180_000 });

let owner: TestUser;
let cousin: TestUser;
let ownerApi: APIRequestContext;
const home = { id: "", slug: `e2e-script-${run}`, name: `Script Home ${run}` };
const postSlug = `e2e-script-post-${run}`;
const guestEmail = `e2e-script-${run}@test.local`;

async function ownerPage(browser: Browser) {
  const context = await browser.newContext({ storageState: await ownerApi.storageState() });
  return context.newPage();
}

test.beforeAll(async () => {
  owner = await createUser("script-owner", { role: "owner", fullName: "Script Owner" });
  cousin = await createUser("script-cousin", { role: "team_member", fullName: `Cousin ${run}` });
  ownerApi = await apiAs();
  expect((await ownerApi.post("/api/admin/login", { data: { email: owner.email, password } })).status()).toBe(200);
  const mfa = (await (await ownerApi.post("/api/admin/mfa/enroll", { data: {} })).json()) as {
    factorId: string;
    secret: string;
  };
  await ownerApi.post("/api/admin/mfa/verify", { data: { factorId: mfa.factorId, code: totpCode(mfa.secret) } });

  const { data: estate } = await admin.from("estates").select("id").limit(1).single();
  const { data } = await admin
    .from("properties")
    .insert({
      name: home.name,
      slug: home.slug,
      estate_id: estate!.id,
      is_published: true,
      instagram_video_url: "https://www.instagram.com/reel/AbC123xyz/",
    })
    .select("id")
    .single();
  home.id = data!.id;
});

test.afterAll(async () => {
  await admin.from("inquiries").delete().eq("guest_email", guestEmail);
  await admin.from("availability_blocks").delete().eq("property_id", home.id);
  await admin.from("properties").delete().eq("id", home.id);
  await admin.from("blog_posts").delete().eq("slug", postSlug);
  await cleanup();
});

test("a property's Instagram video loads only when the guest asks for it", async ({ page }) => {
  await page.goto(`/properties/${home.slug}`);
  await expect(page.locator("iframe[src*='instagram.com']")).toHaveCount(0);
  await page.getByRole("button", { name: "Watch the video" }).click();
  await expect(page.locator("iframe")).toHaveAttribute("src", "https://www.instagram.com/reel/AbC123xyz/embed");
});

test("an inquiry from the home form arrives as New, then is claimed, assigned and answered", async ({
  page,
  browser,
}) => {
  const ip = uniqueIp();
  trackIp(ip);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ip });
  await page.goto("/");
  const form = page.getByRole("region", { name: "Inquiry form" });
  await expect(form.getByRole("button", { name: "Send inquiry" })).toBeEnabled();
  const checkIn = addDays(todayInSast(), 30);
  await form.getByLabel("Full name").fill(`Script Guest ${run}`);
  await form.getByLabel("Email address").fill(guestEmail);
  await form.getByLabel("Phone number").fill("082 123 4567");
  await form.getByLabel("Check-in date").fill(checkIn);
  await form.getByLabel("Check-out date").fill(addDays(checkIn, 3));
  await form.getByLabel(/I agree/).check();
  await expect
    .poll(() => page.evaluate(() => document.querySelector<HTMLInputElement>("[name=cf-turnstile-response]")?.value))
    .toBeTruthy();
  await form.getByRole("button", { name: "Send inquiry" }).click();
  // the first send compiles the route on the dev server
  await expect(form.getByRole("status")).toContainText("Thank you", { timeout: 60_000 });

  const { data: row } = await admin.from("inquiries").select("id, status").eq("guest_email", guestEmail).single();
  expect(row!.status).toBe("new");

  const admin1 = await ownerPage(browser);
  await admin1.goto(`/admin/inquiries?view=${row!.id}`);
  await admin1.getByRole("button", { name: "Claim this inquiry" }).click();
  await expect(admin1.getByText("Saved.")).toBeVisible({ timeout: 60_000 });
  await admin1.goto("/admin");
  await expect(admin1.getByText(`Script Guest ${run}`).first()).toBeVisible();

  await admin1.goto(`/admin/inquiries?view=${row!.id}`);
  const panel = admin1.getByRole("region", { name: `Inquiry from Script Guest ${run}` });
  const save = panel.getByRole("button", { name: "Save update" });
  // a choice made before the panel hydrates is dropped; Save only enables once it has
  await expect(async () => {
    await panel.getByLabel("Status").selectOption({ label: "Answered" });
    await expect(save).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 60_000 });
  await panel.getByLabel("Assign to").selectOption({ label: `Cousin ${run}` });
  await save.click();
  await expect(panel.getByText("Saved.")).toBeVisible({ timeout: 60_000 });

  const { data: after } = await admin.from("inquiries").select("status, assigned_to").eq("id", row!.id).single();
  expect(after).toEqual({ status: "answered", assigned_to: cousin.id });
  expect(await auditRows({ actorId: owner.id, action: "inquiry.assign" })).toBeGreaterThanOrEqual(2);
  expect(await auditRows({ actorId: owner.id, action: "inquiry.status" })).toBeGreaterThanOrEqual(1);
  await admin1.context().close();
});

test("blocking a range and reopening one date agree in the grid and the calendar", async ({ browser }) => {
  const start = addDays(todayInSast(), 40);
  const dates = [0, 1, 2, 3, 4].map((i) => addDays(start, i));
  const res = await ownerApi.post("/api/admin/availability", {
    data: { propertyId: home.id, from: dates[0], to: dates[4], action: "block" },
  });
  expect(res.status(), await res.text()).toBe(200);

  const page = await ownerPage(browser);
  const url = `/admin/availability?home=${home.id}&month=${start.slice(0, 7)}&from=${start}`;
  await page.goto(url);
  await page.getByRole("button", { name: `${home.name}, ${dateRangeLabel(dates[2]!, dates[2]!)}, blocked` }).click();
  // the cell flips at once; the message only appears once the change is saved
  await expect(page.getByText(`${dateRangeLabel(dates[2]!, dates[2]!)} opened for ${home.name}.`)).toBeVisible({
    timeout: 60_000,
  });

  await page.reload();
  for (const [i, date] of dates.entries()) {
    const blocked = i !== 2;
    const label = dateRangeLabel(date, date);
    await expect(
      page.getByRole("button", { name: `${home.name}, ${label}, ${blocked ? "blocked" : "open"}` }),
    ).toHaveAttribute("aria-pressed", String(blocked));
    // the calendar shows one month, so dates past its end are checked in the grid only
    if (date.slice(0, 7) === start.slice(0, 7)) {
      await expect(page.locator(`[data-date="${date}"]`)).toHaveAccessibleName(
        new RegExp(`^${label}, ${blocked ? "Blocked" : "Open"}`),
      );
    }
  }
  await page.context().close();
});

test("a draft post stays hidden, then shows on the site and in the sitemap once published", async () => {
  const fresh = { "cache-control": "no-cache" };
  const created = await ownerApi.post("/api/admin/posts", {
    data: {
      title: `Script Post ${run}`,
      slug: postSlug,
      excerpt: "",
      body_md: "A short test post.",
      is_published: false,
      seo_title: "",
      seo_description: "",
    },
  });
  expect(created.status(), await created.text()).toBe(200);
  const { id } = (await created.json()) as { id: string };

  const guest = await apiAs();
  expect(await (await guest.get("/journal", { headers: fresh })).text()).not.toContain(`Script Post ${run}`);
  expect(await (await guest.get("/sitemap.xml", { headers: fresh })).text()).not.toContain(postSlug);

  expect((await ownerApi.patch(`/api/admin/posts/${id}`, { data: { is_published: true } })).status()).toBe(200);
  expect((await guest.get(`/journal/${postSlug}`, { headers: fresh })).status()).toBe(200);
  expect(await (await guest.get("/journal", { headers: fresh })).text()).toContain(`Script Post ${run}`);
  expect(await (await guest.get("/sitemap.xml", { headers: fresh })).text()).toContain(`/journal/${postSlug}`);
});
