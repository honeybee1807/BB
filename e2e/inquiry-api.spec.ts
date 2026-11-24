import { expect, test } from "@playwright/test";
import { addDays, todayInSast } from "../src/lib/format";
import { hashIdentifier } from "../src/lib/security/hash";
import { client } from "../tests/api/local-stack";
import { admin, apiAs, cleanup, run, stack, uniqueIp } from "./support";

test.describe.configure({ mode: "serial" });

const checkIn = addDays(todayInSast(), 30);

function inquiry(label: string, extra: Record<string, unknown> = {}) {
  return {
    fullName: "Test Guest",
    email: `e2e-inquiry-${label}-${run}@test.local`,
    phone: "082 123 4567",
    checkIn,
    checkOut: addDays(checkIn, 3),
    adults: "2",
    children: "0",
    budgetMin: "",
    budgetMax: "",
    accommodationType: "no_preference",
    requirements: "",
    consent: true,
    // Cloudflare's test secret accepts this token
    turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
    website: "",
    ...extra,
  };
}

async function storedCount(label: string): Promise<number> {
  const { count } = await admin
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("guest_email", `e2e-inquiry-${label}-${run}@test.local`);
  return count ?? 0;
}

test.afterAll(async () => {
  await admin.from("inquiries").delete().like("guest_email", `e2e-inquiry-%-${run}@test.local`);
  await cleanup();
});

test("stores an inquiry and returns nothing but ok", async () => {
  const api = await apiAs();
  const res = await api.post("/api/inquiries", { data: inquiry("ok", { requirements: "Ground floor please" }) });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });

  const { data } = await admin
    .from("inquiries")
    .select("status, adults, additional_requirements, consent_given_at, property_id")
    .eq("guest_email", `e2e-inquiry-ok-${run}@test.local`)
    .single();
  expect(data).toMatchObject({ status: "new", adults: 2, additional_requirements: "Ground floor please" });
  expect(data?.consent_given_at).toBeTruthy();
  expect(data?.property_id).toBeNull();
});

test("an anonymous visitor cannot read inquiries", async () => {
  const anon = client(stack.url, stack.anonKey);
  const { data, error } = await anon.from("inquiries").select("id").limit(1);
  expect(data ?? []).toEqual([]);
  expect(error).not.toBeNull();
});

test("quietly drops a filled honeypot", async () => {
  const api = await apiAs();
  const res = await api.post("/api/inquiries", { data: inquiry("bot", { website: "https://spam.example" }) });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
  expect(await storedCount("bot")).toBe(0);
});

test("rejects a cross-site post", async () => {
  const api = await apiAs();
  const res = await api.post("/api/inquiries", {
    data: inquiry("cross"),
    headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
  });
  expect(res.status()).toBe(403);
  expect(await storedCount("cross")).toBe(0);
});

test("rejects unknown fields and invalid dates", async () => {
  const api = await apiAs();
  const extra = await api.post("/api/inquiries", { data: inquiry("extra", { status: "answered" }) });
  expect(extra.status()).toBe(400);
  const past = await api.post("/api/inquiries", { data: inquiry("past", { checkIn: "2020-01-01" }) });
  expect(past.status()).toBe(400);
  expect(await storedCount("extra")).toBe(0);
});

test("drops an unknown property but keeps the inquiry", async () => {
  const api = await apiAs();
  const res = await api.post("/api/inquiries", {
    data: inquiry("ghost", { propertyId: "00000000-0000-4000-8000-000000000000" }),
  });
  expect(res.status()).toBe(200);
  expect(await storedCount("ghost")).toBe(1);
});

test("rejects a missing security check token", async () => {
  const api = await apiAs();
  const res = await api.post("/api/inquiries", { data: inquiry("notoken", { turnstileToken: "" }) });
  expect(res.status()).toBe(400);
  expect(await storedCount("notoken")).toBe(0);
});

test("limits one address to five inquiries an hour", async () => {
  const ip = uniqueIp();
  const api = await apiAs(ip);
  for (let i = 0; i < 5; i++) {
    const res = await api.post("/api/inquiries", { data: inquiry("limit") });
    expect(res.status()).toBe(200);
  }
  const blocked = await api.post("/api/inquiries", { data: inquiry("limit") });
  expect(blocked.status()).toBe(429);
  expect(await storedCount("limit")).toBe(5);

  // keyed by the HMAC of the address, never the address itself
  const { data } = await admin
    .from("rate_limits")
    .select("bucket, key_hash")
    .like("bucket", "inquiry_%")
    .eq("key_hash", hashIdentifier("ip", ip));
  expect(data?.map((r) => r.bucket).sort()).toEqual([
    ...Array(5).fill("inquiry_ip_day"),
    ...Array(5).fill("inquiry_ip_hour"),
  ]);
  const { count } = await admin.from("rate_limits").select("id", { count: "exact", head: true }).eq("key_hash", ip);
  expect(count).toBe(0);
});
