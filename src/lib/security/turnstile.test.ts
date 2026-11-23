import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { verifyTurnstile } = await import("./turnstile");

function reply(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({ ok, json: async () => body });
}

describe("verifyTurnstile", () => {
  beforeEach(() => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends the secret, token and IP to Cloudflare", async () => {
    const fetch = reply({ success: true });
    vi.stubGlobal("fetch", fetch);
    expect(await verifyTurnstile("token-1", "10.0.0.1")).toBe(true);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const body = init.body as URLSearchParams;
    expect(body.get("secret")).toBe("test-secret");
    expect(body.get("response")).toBe("token-1");
    expect(body.get("remoteip")).toBe("10.0.0.1");
  });

  it("leaves out an unknown IP", async () => {
    const fetch = reply({ success: true });
    vi.stubGlobal("fetch", fetch);
    await verifyTurnstile("token-1", "unknown");
    expect((fetch.mock.calls[0]![1].body as URLSearchParams).has("remoteip")).toBe(false);
  });

  it("rejects a token Cloudflare refuses", async () => {
    vi.stubGlobal("fetch", reply({ success: false, "error-codes": ["invalid-input-response"] }));
    expect(await verifyTurnstile("bad", "10.0.0.1")).toBe(false);
  });

  it("rejects an unexpected reply", async () => {
    vi.stubGlobal("fetch", reply({ success: "yes" }));
    expect(await verifyTurnstile("token-1", "10.0.0.1")).toBe(false);
  });

  it("rejects when Cloudflare returns an error status", async () => {
    vi.stubGlobal("fetch", reply({ success: true }, false));
    expect(await verifyTurnstile("token-1", "10.0.0.1")).toBe(false);
  });

  it("rejects when Cloudflare can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(await verifyTurnstile("token-1", "10.0.0.1")).toBe(false);
  });

  it("rejects everything when the secret is missing", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const fetch = reply({ success: true });
    vi.stubGlobal("fetch", fetch);
    expect(await verifyTurnstile("token-1", "10.0.0.1")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
