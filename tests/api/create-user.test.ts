import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuthUser } from "./local-stack";

type Reply = { data: { user: { id: string } | null }; error: unknown };

function fakeDb(replies: Reply[]) {
  const createUser = vi.fn(async () => replies.shift() ?? { data: { user: null }, error: null });
  return { db: { auth: { admin: { createUser } } } as never, createUser };
}

const ok = (id: string): Reply => ({ data: { user: { id } }, error: null });
const fail = (error: unknown): Reply => ({ data: { user: null }, error });

describe("createAuthUser", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns the new user's id without retrying", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { db, createUser } = fakeDb([ok("u1")]);
    expect(await createAuthUser(db, "a@test.local", "pw")).toBe("u1");
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("retries once after a dropped connection and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { db, createUser } = fakeDb([fail(new AuthRetryableFetchError("fetch failed", 0)), ok("u2")]);
    expect(await createAuthUser(db, "a@test.local", "pw")).toBe("u2");
    expect(createUser).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith("create user: connection dropped, retrying once");
  });

  it("gives up after one retry and keeps the original error", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const second = new AuthRetryableFetchError("fetch failed again", 0);
    const { db, createUser } = fakeDb([fail(new AuthRetryableFetchError("fetch failed", 0)), fail(second)]);
    await expect(createAuthUser(db, "a@test.local", "pw")).rejects.toMatchObject({
      message: "create user: fetch failed again",
      cause: second,
    });
    expect(createUser).toHaveBeenCalledTimes(2);
  });

  it("does not retry a gateway error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { db, createUser } = fakeDb([fail(new AuthRetryableFetchError("bad gateway", 502)), ok("never")]);
    await expect(createAuthUser(db, "a@test.local", "pw")).rejects.toThrow("create user: bad gateway");
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("does not retry other errors", async () => {
    const { db, createUser } = fakeDb([fail(new AuthApiError("User already registered", 422, "email_exists"))]);
    await expect(createAuthUser(db, "a@test.local", "pw")).rejects.toThrow("create user: User already registered");
    expect(createUser).toHaveBeenCalledTimes(1);
  });

  it("passes a thrown error straight through", async () => {
    const createUser = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(createAuthUser({ auth: { admin: { createUser } } } as never, "a@test.local", "pw")).rejects.toThrow(
      "boom",
    );
    expect(createUser).toHaveBeenCalledTimes(1);
  });
});
