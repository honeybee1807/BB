// Auth routes, run against the local dev server and Supabase stack.
import { expect, test, type APIRequestContext } from "@playwright/test";
import { totpCode } from "../tests/api/totp";
import {
  admin,
  apiAs,
  auditRows,
  cleanup,
  createUser,
  emailHashPrefix,
  password,
  trackEmail,
  uniqueIp,
  type TestUser,
} from "./support";

test.describe.configure({ mode: "serial" });

const INVALID = "Email or password is incorrect.";

let owner: TestUser;
let team: TestUser;
let inactive: TestUser;
let outsider: TestUser;
let lockTarget: TestUser;
let mfaTarget: TestUser;

test.beforeAll(async () => {
  owner = await createUser("owner", { role: "owner", fullName: "E2E Owner" });
  team = await createUser("team", { role: "team_member", fullName: "E2E Team" });
  inactive = await createUser("inactive", { role: "team_member", isActive: false });
  outsider = await createUser("outsider");
  lockTarget = await createUser("lock", { role: "team_member" });
  mfaTarget = await createUser("mfa-lock", { role: "owner" });
});

test.afterAll(async () => {
  await cleanup();
});

async function login(api: APIRequestContext, email: string, pw = password) {
  return api.post("/api/admin/login", { data: { email, password: pw } });
}

async function enrolOwner(api: APIRequestContext): Promise<{ factorId: string; secret: string }> {
  const res = await api.post("/api/admin/mfa/enroll", { data: {} });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { factorId: string; secret: string; qrCode: string };
  expect(body.qrCode).toMatch(/^data:image\/svg\+xml/);
  return body;
}

test.describe("signed out", () => {
  test("admin pages return 404 and the login page is noindex", async ({ request }) => {
    for (const path of [
      "/admin",
      "/admin/inquiries",
      "/admin/team",
      "/admin/settings",
      "/admin/mfa",
      "/admin/account",
    ]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(404);
      expect(await res.text()).not.toContain("Welcome");
    }
    const login = await request.get("/admin/login");
    expect(login.status()).toBe(200);
    expect(await login.text()).toMatch(/<meta name="robots" content="noindex, nofollow/);
  });

  test("admin routes need a session", async () => {
    const api = await apiAs();
    expect((await api.post("/api/admin/mfa/enroll", { data: {} })).status()).toBe(401);
    expect(
      (
        await api.post("/api/admin/mfa/verify", {
          data: { factorId: "00000000-0000-4000-8000-000000000000", code: "123456" },
        })
      ).status(),
    ).toBe(401);
  });
});

test.describe("login input", () => {
  test("refuses a missing or foreign Origin", async ({ playwright }) => {
    const noOrigin = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
    expect((await noOrigin.post("/api/admin/login", { data: { email: team.email, password } })).status()).toBe(403);
    const foreign = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: { origin: "https://evil.example" },
    });
    expect((await foreign.post("/api/admin/login", { data: { email: team.email, password } })).status()).toBe(403);
  });

  test("rejects unknown fields, bad emails and non-JSON bodies", async () => {
    const api = await apiAs();
    expect(
      (await api.post("/api/admin/login", { data: { email: team.email, password, role: "owner" } })).status(),
    ).toBe(400);
    expect((await api.post("/api/admin/login", { data: { email: "not-an-email", password } })).status()).toBe(400);
    expect(
      (await api.post("/api/admin/login", { headers: { "content-type": "text/plain" }, data: "email=x" })).status(),
    ).toBe(400);
  });
});

test.describe("lockout", () => {
  test("locks an email after 5 failures, even for the right password", async () => {
    const api = await apiAs();
    for (let i = 1; i <= 4; i++) {
      const res = await login(api, lockTarget.email, "wrong-password");
      expect(res.status(), `attempt ${i}`).toBe(401);
      expect((await res.json()).error).toBe(INVALID);
    }
    const fifth = await login(api, lockTarget.email, "wrong-password");
    expect(fifth.status()).toBe(429);
    expect((await fifth.json()).locked).toBe(true);

    // From a different IP, with the CORRECT password: still locked (no password check).
    const other = await apiAs();
    const correct = await login(other, lockTarget.email);
    expect(correct.status()).toBe(429);

    const prefix = emailHashPrefix(lockTarget.email);
    expect(await auditRows({ action: "login.failed", emailHash: prefix })).toBe(5);
    expect(await auditRows({ action: "login.lockout", emailHash: prefix })).toBe(1);
    expect(await auditRows({ action: "login.ok", actorId: lockTarget.id })).toBe(0);
  });

  test("locks an IP after 5 failures", async () => {
    const ip = uniqueIp();
    const api = await apiAs(ip);
    for (let i = 0; i < 5; i++) {
      const email = `nobody-${i}-${Date.now()}@test.local`;
      trackEmail(email);
      await login(api, email, "wrong-password");
    }
    const res = await login(api, team.email);
    expect(res.status()).toBe(429);
  });

  test("non-admins get the same error as a wrong password", async () => {
    const api = await apiAs();
    for (const user of [outsider, inactive]) {
      const res = await login(api, user.email);
      expect(res.status()).toBe(401);
      expect((await res.json()).error).toBe(INVALID);
    }
    const nobody = `nobody-${Date.now()}@test.local`;
    trackEmail(nobody);
    const unknown = await login(api, nobody);
    expect((await unknown.json()).error).toBe(INVALID);
  });
});

test.describe("team member session", () => {
  test("signs in with httpOnly cookies, stays out of owner pages and signs out", async () => {
    const api = await apiAs();
    const res = await login(api, team.email);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true, next: "/admin" });

    const cookies = res
      .headersArray()
      .filter((h) => h.name.toLowerCase() === "set-cookie")
      .map((h) => h.value);
    const auth = cookies.filter((c) => /^sb-[^=]+-auth-token/.test(c));
    expect(auth.length).toBeGreaterThan(0);
    for (const c of auth) {
      expect(c).toMatch(/HttpOnly/i);
      expect(c).toMatch(/SameSite=Lax/i);
      expect(c).toMatch(/Path=\//);
    }

    const dash = await api.get("/admin");
    expect(dash.status()).toBe(200);
    const html = await dash.text();
    expect(html).toMatch(/Good (morning|afternoon|evening), E2E/);
    expect(html).not.toContain('href="/admin/team"');
    expect(html).not.toContain('href="/admin/settings"');
    for (const path of ["/admin/team", "/admin/settings", "/admin/regions"]) {
      expect((await api.get(path)).status(), path).toBe(404);
    }
    expect((await api.get("/admin/inquiries")).status()).toBe(200);
    expect(await auditRows({ action: "login.ok", actorId: team.id })).toBe(1);

    const out = await api.post("/api/admin/logout", { data: {} });
    expect(out.status()).toBe(200);
    expect((await api.get("/admin", { maxRedirects: 0 })).status()).toBe(404);
    expect(await auditRows({ action: "logout", actorId: team.id })).toBe(1);
  });
});

test.describe("owner two-factor", () => {
  test("owner enrols TOTP before any admin page", async () => {
    test.setTimeout(150_000); // waits for the next 30-second TOTP window
    const api = await apiAs();
    const res = await login(api, owner.email);
    expect(await res.json()).toEqual({ ok: true, next: "/admin/mfa" });
    const cookieBefore = (await api.storageState()).cookies.find((c) => c.name.includes("auth-token"))?.value;

    // aal1: every panel page sends the owner to /admin/mfa.
    for (const path of ["/admin", "/admin/team"]) {
      const page = await api.get(path, { maxRedirects: 0 });
      expect(page.status(), path).toBe(307);
      expect(page.headers().location).toContain("/admin/mfa");
    }
    expect((await api.get("/admin/mfa")).status()).toBe(200);

    const { factorId, secret } = await enrolOwner(api);
    const wrong = await api.post("/api/admin/mfa/verify", { data: { factorId, code: "000000" } });
    expect(wrong.status()).toBe(401);
    const ok = await api.post("/api/admin/mfa/verify", { data: { factorId, code: totpCode(secret) } });
    expect(ok.status()).toBe(200);
    const cookieAfter = (await api.storageState()).cookies.find((c) => c.name.includes("auth-token"))?.value;
    expect(cookieAfter).toBeTruthy();
    expect(cookieAfter).not.toBe(cookieBefore); // a new session token is issued at aal2

    const dash = await api.get("/admin");
    expect(dash.status()).toBe(200);
    expect(await dash.text()).toContain('href="/admin/team"');
    expect((await api.get("/admin/team")).status()).toBe(200);
    expect((await api.post("/api/admin/mfa/enroll", { data: {} })).status()).toBe(409);
    expect(await auditRows({ action: "mfa.verified", actorId: owner.id })).toBe(1);
    expect(await auditRows({ action: "mfa.failed", actorId: owner.id })).toBe(1);

    await api.post("/api/admin/logout", { data: {} });
    const again = await apiAs();
    expect(await (await login(again, owner.email)).json()).toEqual({ ok: true, next: "/admin/mfa" });
    expect((await again.get("/admin", { maxRedirects: 0 })).status()).toBe(307);
    // Wait for the next 30-second TOTP window so the code differs from the one already used.
    await new Promise((r) => setTimeout(r, 31_000 - (Date.now() % 30_000)));
    const verify = await again.post("/api/admin/mfa/verify", { data: { factorId, code: totpCode(secret) } });
    expect(verify.status(), await verify.text()).toBe(200);
    expect((await again.get("/admin")).status()).toBe(200);
  });

  test("a factor id from another account is refused", async () => {
    const api = await apiAs();
    await login(api, team.email);
    const { data } = await admin.auth.admin.mfa.listFactors({ userId: owner.id });
    const ownersFactor = data?.factors[0]?.id;
    expect(ownersFactor).toBeTruthy();
    const res = await api.post("/api/admin/mfa/verify", { data: { factorId: ownersFactor, code: "123456" } });
    expect(res.status()).toBe(400);
  });

  test("locks two-factor after 5 wrong codes", async () => {
    const api = await apiAs();
    await login(api, mfaTarget.email);
    const { factorId, secret } = await enrolOwner(api);
    for (let i = 1; i <= 4; i++) {
      expect(
        (await api.post("/api/admin/mfa/verify", { data: { factorId, code: "000000" } })).status(),
        `code ${i}`,
      ).toBe(401);
    }
    expect((await api.post("/api/admin/mfa/verify", { data: { factorId, code: "000000" } })).status()).toBe(429);
    expect((await api.post("/api/admin/mfa/verify", { data: { factorId, code: totpCode(secret) } })).status()).toBe(
      429,
    );
    expect(await auditRows({ action: "mfa.lockout", actorId: mfaTarget.id })).toBe(1);
  });
});

test.describe("team member TOTP", () => {
  test("asks an enrolled team member for a code", async () => {
    const api = await apiAs();
    await login(api, team.email);
    const { factorId, secret } = await enrolOwner(api); // same route; no owner rights needed
    expect((await api.post("/api/admin/mfa/verify", { data: { factorId, code: totpCode(secret) } })).status()).toBe(
      200,
    );
    await api.post("/api/admin/logout", { data: {} });

    const again = await apiAs();
    expect(await (await login(again, team.email)).json()).toEqual({ ok: true, next: "/admin/mfa" });
    expect((await again.get("/admin", { maxRedirects: 0 })).status()).toBe(307);
  });
});
