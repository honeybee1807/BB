import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { totpCode } from "../tests/api/totp";
import { admin, cleanup, createUser, password, trackIp, uniqueIp, type TestUser } from "./support";

test.describe.configure({ mode: "serial", timeout: 120_000 });

const PAGE = "/about";
let owner: TestUser;
let secret = "";
let saved: { title: string | null; description: string | null; og_image_path: string | null } | null = null;

test.beforeAll(async ({}, testInfo) => {
  owner = await createUser(`seo-ui-${testInfo.project.name.slice(0, 1)}`, { role: "owner", fullName: "Naseema Owner" });
  const { data } = await admin.from("seo_pages").select("title, description, og_image_path").eq("path", PAGE).single();
  saved = data;
});

test.afterAll(async () => {
  const { data } = await admin.from("seo_pages").select("og_image_path").eq("path", PAGE).single();
  if (data?.og_image_path && data.og_image_path !== saved?.og_image_path) {
    await admin.storage.from("property-photos").remove([data.og_image_path]);
  }
  if (saved) await admin.from("seo_pages").update(saved).eq("path", PAGE);
  await cleanup();
});

test.beforeEach(async ({ page }) => {
  const ip = uniqueIp();
  trackIp(ip);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ip });
});

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

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

test("owner edits a page's search title and sees it on the site", async ({ page, isMobile }) => {
  await signInAsOwner(page);
  if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();

  const card = page.getByRole("region", { name: "About", exact: true });
  const title = card.getByLabel("Search title");
  await title.fill("Meet Naseema, who picks every home");
  await expect(card.getByText("34 of about 60 characters.")).toBeVisible();
  await expect(card.getByText("Meet Naseema, who picks every home", { exact: true })).toBeVisible();

  await title.fill("A".repeat(70));
  await expect(card.getByText("70 characters. Over about 60, search results may cut this off.")).toBeVisible();

  await title.fill("Meet Naseema, who picks every home");
  await card.getByLabel("Search description").fill("");
  await expect(card.getByText(/^Empty, so the default is used/)).toBeVisible();
  await card.getByRole("button", { name: "Save changes" }).click();
  await expect(card.getByText("Saved.")).toBeVisible();
  await expect(card.getByText(/^Last changed on .+ by Naseema Owner\.$/)).toBeVisible();
  await expectNoA11yViolations(page);

  await page.goto(PAGE);
  await expect(page).toHaveTitle("Meet Naseema, who picks every home");
});

test("owner adds and removes a share image", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/admin/settings");
  const card = page.getByRole("region", { name: "About", exact: true });

  const jpeg = await sharp({ create: { width: 1200, height: 630, channels: 3, background: "#2f6f8f" } })
    .jpeg()
    .toBuffer();
  await card.getByLabel("Add share image").setInputFiles({ name: "share.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await expect(card.getByText("Share image saved.")).toBeVisible();

  await page.goto(PAGE);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /property-photos\/seo\/.+\.webp$/);

  await page.goto("/admin/settings");
  await card.getByRole("button", { name: "Remove share image" }).click();
  await expect(card.getByText("Share image removed.")).toBeVisible();
  await page.goto(PAGE);
  await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute("content", /\/images\/share\.jpg$/);
});

test("a file that is not an image is refused", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/admin/settings");
  const card = page.getByRole("region", { name: "About", exact: true });
  await card
    .getByLabel("Add share image")
    .setInputFiles({ name: "fake.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not an image") });
  await expect(card.getByText("Please choose a JPEG, PNG or WebP image.")).toBeVisible();
});
