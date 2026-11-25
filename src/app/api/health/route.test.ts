import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const query = { error: null as unknown, throws: false };
vi.mock("@/lib/supabase/public", () => ({
  getPublicClient: () => ({
    from: () => ({
      select: () => ({
        limit: () => ({
          abortSignal: async () => {
            if (query.throws) throw new Error("fetch failed");
            return { error: query.error };
          },
        }),
      }),
    }),
  }),
}));

const { GET } = await import("./route");

let ip = 0;
const request = (from = `10.0.0.${++ip}`) =>
  new Request("http://localhost/api/health", { headers: { "x-real-ip": from } });

describe("GET /api/health", () => {
  beforeEach(() => {
    query.error = null;
    query.throws = false;
  });

  it("answers ok when the database responds", async () => {
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("answers failing with 503 when the database returns an error", async () => {
    query.error = { message: "connection refused", code: "PGRST000" };
    const res = await GET(request());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "failing" });
  });

  it("answers failing when the database cannot be reached at all", async () => {
    query.throws = true;
    const res = await GET(request());
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain("fetch failed");
  });

  it("refuses more than 30 checks a minute from one address", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) statuses.push((await GET(request("10.9.9.9"))).status);
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
    expect((await GET(request("10.9.9.10"))).status).toBe(200);
  });
});
