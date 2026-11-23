import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guessLocation, deviceName, getClientIp } from "./client-info";
import { hashIdentifier } from "./hash";
import { isSameOrigin } from "./origin";

const SITE = "https://www.example.co.za";

function req(url: string, headers: Record<string, string>): Request {
  return new Request(url, { method: "POST", headers });
}

describe("isSameOrigin", () => {
  it("accepts the configured site origin", () => {
    expect(isSameOrigin(req(`${SITE}/api/admin/login`, { origin: SITE }), SITE)).toBe(true);
  });
  it("accepts the origin the request was sent to (local development)", () => {
    expect(isSameOrigin(req("http://localhost:3000/api/x", { origin: "http://localhost:3000" }), SITE)).toBe(true);
  });
  it("refuses a missing Origin header", () => {
    expect(isSameOrigin(req(`${SITE}/api/x`, {}), SITE)).toBe(false);
  });
  it("refuses another origin", () => {
    expect(isSameOrigin(req(`${SITE}/api/x`, { origin: "https://evil.example" }), SITE)).toBe(false);
  });
  it("refuses a look-alike origin", () => {
    expect(isSameOrigin(req(`${SITE}/api/x`, { origin: "https://www.example.co.za.evil.example" }), SITE)).toBe(false);
  });
  it("refuses requests the browser marks cross-site", () => {
    expect(isSameOrigin(req(`${SITE}/api/x`, { origin: SITE, "sec-fetch-site": "cross-site" }), SITE)).toBe(false);
  });
});

describe("hashIdentifier (HMAC-SHA256 keyed with IP_HASH_SECRET)", () => {
  const SECRET_A = "a".repeat(32) + "-test-secret-one";
  const SECRET_B = "b".repeat(32) + "-test-secret-two";
  beforeEach(() => {
    vi.stubEnv("IP_HASH_SECRET", SECRET_A);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is stable, normalised and never contains the raw value", () => {
    const a = hashIdentifier("email", "  Owner@Example.com ");
    expect(a).toBe(hashIdentifier("email", "owner@example.com"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("owner");
  });
  it("namespaces by kind", () => {
    expect(hashIdentifier("ip", "1.2.3.4")).not.toBe(hashIdentifier("email", "1.2.3.4"));
  });
  it("depends on the secret, so it cannot be reproduced without it", () => {
    const withA = hashIdentifier("ip", "1.2.3.4");
    vi.stubEnv("IP_HASH_SECRET", SECRET_B);
    expect(hashIdentifier("ip", "1.2.3.4")).not.toBe(withA);
  });
  it("is not a plain (unkeyed) SHA-256 of the value", () => {
    const plain = createHash("sha256").update("ip:1.2.3.4").digest("hex");
    expect(hashIdentifier("ip", "1.2.3.4")).not.toBe(plain);
  });
  it("refuses to hash without a secret of at least 32 characters", () => {
    vi.stubEnv("IP_HASH_SECRET", "");
    expect(() => hashIdentifier("ip", "1.2.3.4")).toThrow(/IP_HASH_SECRET/);
    vi.stubEnv("IP_HASH_SECRET", "short-secret");
    expect(() => hashIdentifier("ip", "1.2.3.4")).toThrow(/IP_HASH_SECRET/);
  });
});

describe("client info", () => {
  it("prefers x-real-ip, then the first x-forwarded-for entry", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(getClientIp(new Headers({ "x-forwarded-for": "3.3.3.3, 10.0.0.1" }))).toBe("3.3.3.3");
    expect(getClientIp(new Headers())).toBe("unknown");
  });
  it("builds an approximate location from Vercel geo headers", () => {
    expect(guessLocation(new Headers({ "x-vercel-ip-city": "Cape%20Town", "x-vercel-ip-country": "ZA" }))).toBe("Cape Town, ZA");
    expect(guessLocation(new Headers())).toBe("Unknown location");
  });
  it("describes common devices", () => {
    expect(deviceName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Version/18.0 Mobile Safari/604.1")).toBe("Safari on iOS");
    expect(deviceName("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0")).toBe("Edge on Windows");
    expect(deviceName(null)).toBe("Unknown device");
  });
});
