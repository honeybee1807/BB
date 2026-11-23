import { describe, expect, it } from "vitest";
import { approximateLocation, describeDevice, getClientIp } from "./client-info";
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

describe("hashIdentifier", () => {
  it("is stable, normalised and never contains the raw value", () => {
    const a = hashIdentifier("email", "  Owner@Example.com ");
    expect(a).toBe(hashIdentifier("email", "owner@example.com"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("owner");
  });
  it("namespaces by kind", () => {
    expect(hashIdentifier("ip", "1.2.3.4")).not.toBe(hashIdentifier("email", "1.2.3.4"));
  });
});

describe("client info", () => {
  it("prefers x-real-ip, then the first x-forwarded-for entry", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(getClientIp(new Headers({ "x-forwarded-for": "3.3.3.3, 10.0.0.1" }))).toBe("3.3.3.3");
    expect(getClientIp(new Headers())).toBe("unknown");
  });
  it("builds an approximate location from Vercel geo headers", () => {
    expect(approximateLocation(new Headers({ "x-vercel-ip-city": "Cape%20Town", "x-vercel-ip-country": "ZA" }))).toBe("Cape Town, ZA");
    expect(approximateLocation(new Headers())).toBe("Unknown location");
  });
  it("describes common devices", () => {
    expect(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Version/18.0 Mobile Safari/604.1")).toBe("Safari on iOS");
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0")).toBe("Edge on Windows");
    expect(describeDevice(null)).toBe("Unknown device");
  });
});
