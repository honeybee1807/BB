import { expect, test, type Page } from "@playwright/test";
import { admin, cleanup, createUser, password, trackIp, uniqueIp, type TestUser } from "./support";

test.describe.configure({ mode: "serial" });

let amina: TestUser;
let sipho: TestUser;
let inquiryId: string;

test.beforeAll(async ({}, testInfo) => {
  const p = testInfo.project.name.replace(/[^a-z]/g, "");
  amina = await createUser(`panel-amina-${p}`, { role: "team_member", fullName: "Amina Panel" });
  sipho = await createUser(`panel-sipho-${p}`, { role: "team_member", fullName: "Sipho Panel" });
});

test.beforeEach(async ({ page }) => {
  const ip = uniqueIp();
  trackIp(ip);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ip });
  const { data, error } = await admin
    .from("inquiries")
    .insert({
      guest_name: "Panel Guest",
      guest_email: "panel-guest@example.com",
      guest_phone: "0820000000",
      check_in: "2027-03-01",
      check_out: "2027-03-04",
      adults: 2,
      consent_given_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`inquiry: ${error.message}`);
  inquiryId = data.id;
});

test.afterEach(async () => {
  await admin.from("inquiries").delete().eq("id", inquiryId);
});

test.afterAll(async () => {
  await cleanup();
});

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(amina.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

const panelOf = (page: Page) => page.getByRole("region", { name: "Inquiry from Panel Guest" });

async function pickAndSave(page: Page) {
  const panel = panelOf(page);
  await panel.getByLabel("Status").selectOption("answered");
  await panel.getByLabel("Assign to").selectOption(sipho.id);
  await panel.getByRole("button", { name: "Save update" }).click();
  await expect(panel.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  const { data } = await admin.from("inquiries").select("status, assigned_to").eq("id", inquiryId).single();
  expect(data).toEqual({ status: "answered", assigned_to: sipho.id });
}

test("the panel stays locked until it has loaded", async ({ page }) => {
  await signIn(page);
  // hold the scripts back so the panel is still server-rendered HTML
  await page.route("**/_next/static/chunks/**", async (route) => {
    await new Promise((done) => setTimeout(done, 3000));
    await route.continue();
  });
  await page.goto(`/admin/inquiries?view=${inquiryId}`, { waitUntil: "commit" });
  const panel = panelOf(page);
  await expect(panel.getByText("Loading this inquiry...")).toBeVisible();
  await expect(panel.getByLabel("Status")).toBeDisabled();
  await expect(panel.getByLabel("Assign to")).toBeDisabled();
  await expect(panel.getByText("Loading this inquiry...")).toBeHidden();
  await pickAndSave(page);
});

test("a status and assignee chosen straight after opening are saved", async ({ page }) => {
  await signIn(page);
  await page.goto(`/admin/inquiries?view=${inquiryId}`, { waitUntil: "commit" });
  await pickAndSave(page);
});
