import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { newInviteToken } from "../src/lib/security/invite-token";
import { totpCode } from "../tests/api/totp";
import {
  admin,
  cleanup,
  createUser,
  password,
  run,
  trackEmail,
  trackIp,
  trackUserByEmail,
  uniqueIp,
  type TestUser,
} from "./support";

test.describe.configure({ mode: "serial", timeout: 120_000 });

let owner: TestUser;
let inviteEmail = "";
let secret = "";
const name = "Zainab Newcomer";
const newPassword = "a calm week by the sea";

test.beforeAll(async ({}, testInfo) => {
  const p = testInfo.project.name.slice(0, 1);
  owner = await createUser(`team-ui-owner-${p}`, { role: "owner", fullName: "Naseema Owner" });
  inviteEmail = `e2e-team-ui-${p}-${run}@test.local`;
  trackEmail(inviteEmail);
});

test.afterAll(async () => {
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

async function signIn(page: Page, email: string, pw: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function signInAsOwner(page: Page) {
  await signIn(page, owner.email, password);
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

test("owner invites a team member", async ({ page, isMobile }) => {
  await signInAsOwner(page);
  if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Team & settings" }).click();
  await expect(page.getByRole("heading", { name: "Team & settings", level: 1 })).toBeVisible();

  const me = page.getByRole("listitem").filter({ hasText: owner.email });
  await expect(me.getByText("(you)")).toBeVisible();
  await expect(me.getByRole("button")).toHaveCount(0);
  await expect(me.getByRole("combobox")).toHaveCount(0);

  await page.getByRole("button", { name: "Add team member" }).click();
  await page.getByLabel("Email address").fill("not an email");
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();

  await page.getByLabel("Email address").fill(inviteEmail);
  await page.getByLabel("Role", { exact: true }).selectOption("team_member");
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByText("Invite sent, unless that address is already on the team.")).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: inviteEmail });
  await expect(row.getByText("Invited", { exact: true })).toBeVisible();
  await expectNoA11yViolations(page);
});

test("the invitee sets up their account and signs in", async ({ page }) => {
  // the email would carry this token; the test swaps in one it knows
  const { token, hash } = newInviteToken();
  await admin.from("team_invites").update({ token_hash: hash }).eq("email", inviteEmail).is("cancelled_at", null);

  await page.goto("/admin/invite");
  await expect(page.getByText("This link is incomplete.")).toBeVisible();

  await page.goto(`/admin/invite#${token}`);
  await expect(page.getByRole("heading", { name: "Set up your account" })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Choose a password").fill(newPassword);
  await page.getByLabel("Type the password again").fill("something else entirely");
  await page.getByRole("button", { name: "Set up account" }).click();
  await expect(page.getByText("The passwords don't match.")).toBeVisible();

  await page.getByLabel("Type the password again").fill(newPassword);
  await page.getByRole("button", { name: "Set up account" }).click();
  await expect(page.getByRole("status")).toHaveText("Your account is ready. Please sign in.");
  await trackUserByEmail(inviteEmail);

  await signIn(page, inviteEmail, newPassword);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: /^Good (morning|afternoon|evening), Zainab$/ })).toBeVisible();

  await page.goto(`/admin/invite#${token}`);
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Choose a password").fill(newPassword);
  await page.getByLabel("Type the password again").fill(newPassword);
  await page.getByRole("button", { name: "Set up account" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "can't be used" })).toBeVisible();
});

test("owner deactivates and then removes the new member", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/admin/team");
  const row = page.getByRole("listitem").filter({ hasText: inviteEmail });
  await expect(row.getByText("Active", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: `Deactivate ${name}` }).click();
  await expect(page.getByText(`${name} can no longer sign in.`)).toBeVisible();
  await expect(row.getByText("Deactivated", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await row.getByRole("button", { name: `Remove ${name}` }).click();
  await expect(page.getByText(`${name} was removed.`)).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: inviteEmail })).toHaveCount(0);
});
