// Team routes, run against the local dev server and Supabase stack.
import { expect, test, type APIRequestContext } from "@playwright/test";
import { hashIdentifier } from "../src/lib/security/hash";
import { newInviteToken } from "../src/lib/security/invite-token";
import { totpCode } from "../tests/api/totp";
import {
  admin,
  apiAs,
  cleanup,
  createUser,
  password,
  run,
  trackEmail,
  trackUserByEmail,
  type TestUser,
} from "./support";

test.describe.configure({ mode: "serial" });

const UNUSABLE = /can't be used/;
const newPassword = "a calm week by the sea";

let owner: TestUser;
let team: TestUser;
let ownerApi: APIRequestContext;

const address = (label: string) => {
  const email = `e2e-invite-${label}-${run}@test.local`;
  trackEmail(email);
  return email;
};

async function signIn(email: string, pw = password): Promise<APIRequestContext> {
  const api = await apiAs();
  const res = await api.post("/api/admin/login", { data: { email, password: pw } });
  expect(res.status(), await res.text()).toBe(200);
  return api;
}

// Stands in for the email: the test swaps in a token it knows, as the real link would carry.
async function plantToken(email: string): Promise<string> {
  const { token, hash } = newInviteToken();
  const { data } = await admin
    .from("team_invites")
    .update({ token_hash: hash })
    .eq("email", email)
    .is("accepted_at", null)
    .is("cancelled_at", null)
    .select("id");
  expect(data).toHaveLength(1);
  return token;
}

async function invite(email: string, role: "owner" | "team_member" = "team_member") {
  return ownerApi.post("/api/admin/team/invites", { data: { email, role } });
}

async function accept(token: string, extra: Record<string, unknown> = {}) {
  const api = await apiAs();
  return api.post("/api/admin/invite/accept", {
    data: { token, fullName: "New Person", password: newPassword, ...extra },
  });
}

test.beforeAll(async () => {
  owner = await createUser("team-owner", { role: "owner", fullName: "Team Owner" });
  team = await createUser("team-member", { role: "team_member", fullName: "Team Member" });
  ownerApi = await signIn(owner.email);
  const enrol = (await (await ownerApi.post("/api/admin/mfa/enroll", { data: {} })).json()) as {
    factorId: string;
    secret: string;
  };
  const verify = await ownerApi.post("/api/admin/mfa/verify", {
    data: { factorId: enrol.factorId, code: totpCode(enrol.secret) },
  });
  expect(verify.status()).toBe(200);
});

test.afterAll(async () => {
  await cleanup();
});

test("a team member cannot open the team page or use any team route", async () => {
  const api = await signIn(team.email);
  expect((await api.get("/admin/team")).status()).toBe(404);
  expect(
    (await api.post("/api/admin/team/invites", { data: { email: address("by-team"), role: "owner" } })).status(),
  ).toBe(404);
  expect((await api.patch(`/api/admin/team/members/${team.id}`, { data: { role: "owner" } })).status()).toBe(404);
  expect((await api.patch(`/api/admin/team/members/${owner.id}`, { data: { active: false } })).status()).toBe(404);
  expect((await api.delete(`/api/admin/team/members/${owner.id}`)).status()).toBe(404);
  expect(
    (
      await api.patch("/api/admin/team/invites/00000000-0000-4000-8000-000000000000", { data: { action: "resend" } })
    ).status(),
  ).toBe(404);
  const { data: profile } = await admin.from("admin_profiles").select("role").eq("id", team.id).single();
  expect(profile?.role).toBe("team_member");
  const { count } = await admin
    .from("team_invites")
    .select("id", { count: "exact", head: true })
    .eq("email", address("by-team"));
  expect(count).toBe(0);
});

test("a team member's page shows no other member's details", async () => {
  const api = await signIn(team.email);
  const html = await (await api.get("/admin")).text();
  expect(html).not.toContain(owner.email);
});

test("the owner cannot change their own role or access, or remove themselves", async () => {
  const role = await ownerApi.patch(`/api/admin/team/members/${owner.id}`, { data: { role: "team_member" } });
  expect(role.status()).toBe(400);
  expect((await ownerApi.patch(`/api/admin/team/members/${owner.id}`, { data: { active: false } })).status()).toBe(400);
  expect((await ownerApi.delete(`/api/admin/team/members/${owner.id}`)).status()).toBe(400);
  const { data } = await admin.from("admin_profiles").select("role, is_active").eq("id", owner.id).single();
  expect(data).toEqual({ role: "owner", is_active: true });
});

test("team routes refuse a request from another site", async ({ playwright }) => {
  const foreign = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
    extraHTTPHeaders: { origin: "https://evil.example" },
    storageState: await ownerApi.storageState(),
  });
  expect(
    (await foreign.post("/api/admin/team/invites", { data: { email: address("foreign"), role: "owner" } })).status(),
  ).toBe(403);
});

test("an invite stores only a hash and expires in 7 days", async () => {
  const email = address("stored");
  expect((await invite(email)).status()).toBe(200);
  const { data } = await admin
    .from("team_invites")
    .select("token_hash, invited_by, expires_at, sent_at")
    .eq("email", email)
    .single();
  expect(data?.token_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(data?.invited_by).toBe(owner.id);
  const days = (Date.parse(data!.expires_at) - Date.parse(data!.sent_at)) / 86_400_000;
  expect(days).toBeCloseTo(7, 3);
});

test("accepting an invite creates the account with exactly the invited role", async () => {
  const email = address("joins");
  expect((await invite(email, "owner")).status()).toBe(200);
  const token = await plantToken(email);

  expect((await accept(token, { role: "team_member" })).status()).toBe(400);
  const res = await accept(token);
  expect(res.status(), await res.text()).toBe(200);

  const user = await trackUserByEmail(email);
  const { data: profile } = await admin
    .from("admin_profiles")
    .select("role, full_name, is_active")
    .eq("id", user.id)
    .single();
  expect(profile).toEqual({ role: "owner", full_name: "New Person", is_active: true });
  const login = await (await apiAs()).post("/api/admin/login", { data: { email, password: newPassword } });
  expect(await login.json()).toMatchObject({ ok: true, next: "/admin/mfa" });
});

test("a used invite cannot be used again", async () => {
  const email = address("reuse");
  await invite(email);
  const token = await plantToken(email);
  expect((await accept(token)).status()).toBe(200);
  await trackUserByEmail(email);
  const again = await accept(token);
  expect(again.status()).toBe(400);
  expect((await again.json()).error).toMatch(UNUSABLE);
});

test("an expired invite is refused and creates no account", async () => {
  const email = address("expired");
  await invite(email);
  const token = await plantToken(email);
  await admin
    .from("team_invites")
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("email", email);
  const res = await accept(token);
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toMatch(UNUSABLE);
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  expect(data.users.some((u) => u.email === email)).toBe(false);
});

test("resending replaces the link and cancelling withdraws it", async () => {
  const email = address("resend");
  await invite(email);
  const old = await plantToken(email);
  const { data: row } = await admin
    .from("team_invites")
    .select("id")
    .eq("email", email)
    .is("cancelled_at", null)
    .single();

  expect((await ownerApi.patch(`/api/admin/team/invites/${row!.id}`, { data: { action: "resend" } })).status()).toBe(
    200,
  );
  expect((await accept(old)).status()).toBe(400);

  const fresh = await plantToken(email);
  expect((await ownerApi.patch(`/api/admin/team/invites/${row!.id}`, { data: { action: "cancel" } })).status()).toBe(
    200,
  );
  expect((await accept(fresh)).status()).toBe(400);
});

test("inviting someone already on the team gets the usual reply and sends nothing", async () => {
  const res = await invite(team.email);
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
  const { count } = await admin
    .from("team_invites")
    .select("id", { count: "exact", head: true })
    .eq("email", team.email);
  expect(count).toBe(0);
});

test("invites to one address are limited to three a day", async () => {
  // start the owner afresh so only the per-address limit is in play
  await admin.from("rate_limits").delete().eq("key_hash", hashIdentifier("user", owner.id));
  const email = address("limit");
  for (let i = 0; i < 3; i++) expect((await invite(email)).status()).toBe(200);
  expect((await invite(email)).status()).toBe(429);
});

test("a deactivated member loses access at once, even with an open session", async () => {
  const member = await createUser("deactivate", { role: "team_member", fullName: "Soon Off" });
  const api = await signIn(member.email);
  expect((await api.get("/admin")).status()).toBe(200);

  expect((await ownerApi.patch(`/api/admin/team/members/${member.id}`, { data: { active: false } })).status()).toBe(
    200,
  );
  expect((await api.get("/admin")).status()).toBe(404);
  // 401 once the ban has ended the session, 404 while only the profile is switched off
  const change = await api.patch(`/api/admin/inquiries/00000000-0000-4000-8000-000000000000`, {
    data: { status: "closed" },
  });
  expect([401, 404]).toContain(change.status());
  expect((await (await apiAs()).post("/api/admin/login", { data: { email: member.email, password } })).status()).toBe(
    401,
  );

  expect((await ownerApi.patch(`/api/admin/team/members/${member.id}`, { data: { active: true } })).status()).toBe(200);
  expect((await (await apiAs()).post("/api/admin/login", { data: { email: member.email, password } })).status()).toBe(
    200,
  );
});

test("a removed member cannot sign in or claim, and their inquiry stays as unassigned", async () => {
  const member = await createUser("remove", { role: "team_member", fullName: "Leaving Soon" });
  const { data: inquiry } = await admin
    .from("inquiries")
    .insert({
      guest_name: "E2E Guest",
      guest_email: "guest@example.com",
      guest_phone: "0820000000",
      check_in: "2027-03-01",
      check_out: "2027-03-04",
      adults: 2,
      consent_given_at: new Date().toISOString(),
      status: "claimed",
      assigned_to: member.id,
    })
    .select("id")
    .single();
  const api = await signIn(member.email);

  try {
    expect((await ownerApi.delete(`/api/admin/team/members/${member.id}`)).status()).toBe(200);
    const claim = await api.patch(`/api/admin/inquiries/${inquiry!.id}`, { data: { assignedTo: member.id } });
    expect([401, 404]).toContain(claim.status());
    expect((await (await apiAs()).post("/api/admin/login", { data: { email: member.email, password } })).status()).toBe(
      401,
    );

    const { data: after } = await admin.from("inquiries").select("status, assigned_to").eq("id", inquiry!.id).single();
    expect(after).toEqual({ status: "claimed", assigned_to: null });
    const list = await ownerApi.get("/admin/inquiries");
    expect(list.status()).toBe(200);
  } finally {
    await admin.from("inquiries").delete().eq("id", inquiry!.id);
  }
});
