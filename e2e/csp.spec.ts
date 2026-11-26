// Every page type must send the CSP header and load without the browser blocking anything it needs.
import { expect, test, type Page, type Request } from "@playwright/test";
import { admin, cleanup, createUser, password, run, trackIp, uniqueIp, type TestUser } from "./support";

test.describe.configure({ mode: "serial", timeout: 180_000 });

let team: TestUser;
let inquiryId = "";
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
  const { data: inquiry, error } = await admin
    .from("inquiries")
    .insert({
      guest_name: "Csp Guest",
      guest_email: `csp-guest-${run}@example.com`,
      guest_phone: "0820000000",
      check_in: "2027-03-01",
      check_out: "2027-03-04",
      adults: 2,
      consent_given_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`inquiry: ${error.message}`);
  inquiryId = inquiry.id;
});

test.afterAll(async () => {
  if (inquiryId) await admin.from("inquiries").delete().eq("id", inquiryId);
  await cleanup();
});

test.beforeEach(async ({ page }) => {
  const ip = uniqueIp();
  trackIp(ip);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ip });
});

const at = (url: string) => {
  const u = new URL(url);
  return u.pathname + u.search;
};

// Policy violations, refused or failed loads and CSP console errors, filed under the page they
// happened on, so a late one is never lost or blamed on the next page.
async function watch(page: Page) {
  const findings = new Map<string, string[]>();
  const add = (url: string, line: string) => {
    const key = at(url);
    findings.set(key, [...(findings.get(key) ?? []), line]);
  };
  const loading = new Set<Request>();
  await page.exposeFunction("reportCsp", (url: string, line: string) => add(url, line));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { reportCsp: (url: string, line: string) => void }).reportCsp(
        e.documentURI,
        `${e.violatedDirective} ${e.blockedURI} from ${e.sourceFile || "the page"}:${e.lineNumber}`,
      );
    });
  });
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|Refused to/i.test(m.text())) add(page.url(), m.text());
  });
  page.on("request", (r) => loading.add(r));
  page.on("requestfinished", (r) => loading.delete(r));
  page.on("requestfailed", (r) => {
    loading.delete(r);
    const failure = r.failure()?.errorText ?? "";
    // a load cut short by the next navigation is not a block; CSP blocks show as ERR_BLOCKED_BY_CSP
    if (failure === "net::ERR_ABORTED") return;
    if (["script", "image", "stylesheet", "font"].includes(r.resourceType())) {
      add(r.frame().url(), `${failure} ${r.url()}`);
    }
  });
  return { findings, loading, add };
}

// Waits for network idle, but at most 5 seconds; what is still loading then is noted on the report.
async function settle(page: Page, loading: Set<Request>, path: string) {
  const idle = await page
    .waitForLoadState("networkidle", { timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (!idle) {
    const urls = [...new Set([...loading].map((r) => r.url().split("?")[0]))].join(", ");
    test.info().annotations.push({ type: "still loading", description: `${path}: ${urls}` });
  }
}

async function check(page: Page, paths: string[]) {
  const { findings, loading, add } = await watch(page);
  for (const path of paths) {
    loading.clear();
    const res = await page.goto(path);
    await settle(page, loading, path);
    expect.soft(res!.headers()["content-security-policy"], `header on ${path}`).toContain("default-src 'self'");
    const broken = await page.evaluate(() =>
      [...document.images]
        .filter((img) => img.currentSrc && img.complete && img.naturalWidth === 0)
        .map((img) => img.currentSrc),
    );
    for (const src of broken) add(page.url(), `broken image ${src}`);
  }
  await settle(page, loading, "after the last page");
  expect(Object.fromEntries(findings), "anything blocked, by page").toEqual({});
}

test("public pages load within the policy", async ({ page }) => {
  await check(page, [
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
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(team.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await check(page, [
    "/admin",
    "/admin/properties",
    `/admin/properties/${real.propertyId}`,
    "/admin/properties/new",
    "/admin/availability",
    "/admin/inquiries",
    `/admin/inquiries/${inquiryId}`,
    `/admin/inquiries?view=${inquiryId}`,
    "/admin/journal",
    `/admin/journal/${real.postId}`,
    "/admin/journal/new",
    "/admin/team",
    "/admin/account",
  ]);
});

// Shows whether the form still works under the production policy, which has no 'unsafe-eval'.
test("the inquiry form gets a Turnstile token", async ({ page }) => {
  await page.goto("/contact");
  await expect
    .poll(() => page.evaluate(() => document.querySelector<HTMLInputElement>("[name=cf-turnstile-response]")?.value))
    .toBeTruthy();
});
