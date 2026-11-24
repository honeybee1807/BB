import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { totpCode } from "../tests/api/totp";
import { cleanup, createUser, password, trackIp, uniqueIp, type TestUser } from "./support";

test.describe.configure({ mode: "serial" });

let team: TestUser;
let owner: TestUser;

test.beforeAll(async ({}, testInfo) => {
  const p = testInfo.project.name.replace(/[^a-z]/g, "");
  team = await createUser(`ui-team-${p}`, { role: "team_member", fullName: "Amina Team" });
  owner = await createUser(`ui-owner-${p}`, { role: "owner", fullName: "Naledi Owner" });
});

test.afterAll(async () => {
  await cleanup();
});

// Each test acts from its own fake IP so IP rate limits never carry over.
test.beforeEach(async ({ page }) => {
  const ip = uniqueIp();
  trackIp(ip);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ip });
});

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

async function signIn(page: Page, user: TestUser) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("an early click never puts the password in the URL", async ({ page }) => {
  // hold the scripts back so the form is still server-rendered HTML
  await page.route("**/_next/static/chunks/**", async (route) => {
    await new Promise((done) => setTimeout(done, 3000));
    await route.continue();
  });
  await page.goto("/admin/login", { waitUntil: "commit" });
  await page.getByLabel("Email").fill("someone@test.local");
  await page.getByLabel("Password").fill("not-a-real-password");
  const signIn = page.getByRole("button", { name: "Sign in" });
  await expect(signIn).toBeDisabled();
  await signIn.click({ force: true, noWaitAfter: true });
  await expect(signIn).toBeEnabled();
  expect(page.url()).not.toContain("password");
  expect(new URL(page.url()).search).toBe("");
});

test("login form validates input and shows a neutral error", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();

  await page.getByLabel("Email").fill(team.email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Email or password is incorrect." })).toBeVisible();
});

test("team member sees the dashboard without owner links", async ({ page, isMobile }) => {
  await signIn(page, team);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Welcome back, Amina")).toBeVisible();

  if (isMobile) {
    const menu = page.getByRole("button", { name: "Open menu" });
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(page.getByRole("dialog", { name: /Admin menu/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await menu.click();
  }
  const nav = page.getByRole("navigation", { name: "Admin" });
  await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Inquiries" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Team" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Settings" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Owners" })).toHaveCount(0);
  await expectNoA11yViolations(page);

  await nav.getByRole("link", { name: "Inquiries" }).click();
  await expect(page).toHaveURL(/\/admin\/inquiries$/);
  await expect(page.getByRole("heading", { name: "Inquiries" })).toBeVisible();
});

test("owner sets up two-factor before reaching the dashboard", async ({ page }) => {
  await signIn(page, owner);
  await expect(page).toHaveURL(/\/admin\/mfa$/);
  await expect(page.getByRole("heading", { name: "Set up two-factor sign-in" })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole("button", { name: "Set up two-factor sign-in" }).click();
  await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
  const secret = (await page.locator("p", { hasText: "setup key" }).locator("code").textContent())?.trim() ?? "";
  expect(secret).toMatch(/^[A-Z2-7]+=*$/);
  await expectNoA11yViolations(page);

  await page.getByLabel("Authentication code").fill(totpCode(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("Welcome back, Naledi")).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Admin", includeHidden: true });
  await expect(nav.getByRole("link", { name: "Team", includeHidden: true })).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Settings", includeHidden: true })).toHaveCount(1);
});

test("signs out after 30 minutes without activity", async ({ page }) => {
  await page.clock.install();
  await signIn(page, team);
  await expect(page).toHaveURL(/\/admin$/);
  // Wait until the idle timer has mounted (it records the first activity timestamp).
  await page.waitForFunction(() => localStorage.getItem("bb-admin-last-activity") !== null);
  await page.clock.fastForward("31:00");
  await expect(page).toHaveURL(/\/admin\/login\?reason=idle$/);
  await expect(page.getByRole("status")).toHaveText("You were signed out after 30 minutes without activity.");
  // The session is really gone, not just hidden.
  const res = await page.request.get("/admin", { maxRedirects: 0 });
  expect(res.status()).toBe(404);
});
