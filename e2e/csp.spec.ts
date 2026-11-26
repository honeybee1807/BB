// Every page type must send the CSP header and load without the browser blocking anything it needs.
import { expect, test, type Page } from "@playwright/test";
import { admin, cleanup, createUser, password, run, trackIp, uniqueIp, type TestUser } from "./support";

test.describe.configure({ mode: "serial", timeout: 180_000 });

let team: TestUser;
let real: { property: string; propertyId: string; post: string; postId: string; region: string; estate: string };

test.beforeAll(async () => {
  team = await createUser("csp-team", { role: "team_member", fullName: "Csp Team" });
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
  const estate = home!.estate as unknown as { slug: string; region: { slug: string } };
  real = {
    property: home!.slug,
    propertyId: home!.id,
    post: post!.slug,
    postId: post!.id,
    region: estate.region.slug,
    estate: estate.slug,
  };
});

test.afterAll(async () => {
  await cleanup();
});

test.beforeEach(async ({ page }) => {
  const ip = uniqueIp();
  trackIp(ip);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ip });
});

// Collects policy violations, refused or failed script and image loads, and CSP console errors.
async function watch(page: Page): Promise<string[]> {
  const blocked: string[] = [];
  await page.exposeFunction("reportCsp", (line: string) => blocked.push(line));
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|Refused to/i.test(m.text())) blocked.push(m.text());
  });
  page.on("requestfailed", (r) => {
    const failure = r.failure()?.errorText ?? "";
    // a load cut short by the next navigation is not a block; CSP blocks show as ERR_BLOCKED_BY_CSP
    if (failure === "net::ERR_ABORTED") return;
    if (["script", "image", "stylesheet", "font"].includes(r.resourceType())) blocked.push(`${failure} ${r.url()}`);
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { reportCsp: (line: string) => void }).reportCsp(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  return blocked;
}

async function check(page: Page, blocked: string[], paths: string[]) {
  for (const path of paths) {
    blocked.length = 0;
    const res = await page.goto(path, { waitUntil: "networkidle" });
    expect.soft(res!.headers()["content-security-policy"], `header on ${path}`).toContain("default-src 'self'");
    const broken = await page.evaluate(() =>
      [...document.images]
        .filter((img) => img.currentSrc && img.complete && img.naturalWidth === 0)
        .map((img) => img.currentSrc),
    );
    expect.soft([...blocked, ...broken.map((src) => `broken image ${src}`)], `blocked on ${path}`).toEqual([]);
  }
}

test("public pages load within the policy", async ({ page }) => {
  const blocked = await watch(page);
  await check(page, blocked, [
    "/",
    "/properties",
    `/properties/${real.property}`,
    `/regions/${real.region}`,
    `/regions/${real.region}/${real.estate}`,
    "/about",
    "/contact",
    "/privacy",
    "/journal",
    `/journal/${real.post}`,
    `/journal/e2e-missing-${run}`,
    "/admin/login",
  ]);
});

test("admin pages load within the policy", async ({ page }) => {
  const blocked = await watch(page);
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(team.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await check(page, blocked, [
    "/admin",
    "/admin/properties",
    `/admin/properties/${real.propertyId}`,
    "/admin/properties/new",
    "/admin/availability",
    "/admin/inquiries",
    "/admin/journal",
    `/admin/journal/${real.postId}`,
    "/admin/journal/new",
    "/admin/team",
    "/admin/account",
  ]);
});
