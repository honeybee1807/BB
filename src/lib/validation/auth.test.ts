import { describe, expect, it } from "vitest";
import { needsTwoFactor } from "@/lib/auth/two-factor-rule";
import { loginSchema, logoutSchema, mfaVerifySchema } from "./auth";

describe("loginSchema", () => {
  it("accepts an email and password", () => {
    expect(loginSchema.safeParse({ email: "a@example.com", password: "x" }).success).toBe(true);
  });
  it("rejects unknown fields", () => {
    expect(loginSchema.safeParse({ email: "a@example.com", password: "x", role: "owner" }).success).toBe(false);
  });
  it("rejects a bad email, an empty password and oversized input", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@example.com", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@example.com", password: "x".repeat(201) }).success).toBe(false);
  });
});

describe("mfaVerifySchema", () => {
  const factorId = "00000000-0000-4000-8000-000000000001";
  it("accepts a uuid and a 6-digit code", () => {
    expect(mfaVerifySchema.safeParse({ factorId, code: "123456" }).success).toBe(true);
  });
  it("rejects other codes and extra fields", () => {
    expect(mfaVerifySchema.safeParse({ factorId, code: "12345" }).success).toBe(false);
    expect(mfaVerifySchema.safeParse({ factorId, code: "12345a" }).success).toBe(false);
    expect(mfaVerifySchema.safeParse({ factorId, code: "123456", userId: "x" }).success).toBe(false);
  });
});

describe("logoutSchema", () => {
  it("accepts an empty body or a known reason only", () => {
    expect(logoutSchema.safeParse({}).success).toBe(true);
    expect(logoutSchema.safeParse({ reason: "idle" }).success).toBe(true);
    expect(logoutSchema.safeParse({ reason: "other" }).success).toBe(false);
  });
});

describe("needsTwoFactor", () => {
  it("the owner always needs aal2", () => {
    expect(needsTwoFactor("owner", "aal1", "aal1")).toBe(true); // not enrolled yet: must enrol
    expect(needsTwoFactor("owner", "aal1", "aal2")).toBe(true);
    expect(needsTwoFactor("owner", "aal2", "aal2")).toBe(false);
  });
  it("a team member needs aal2 only once enrolled", () => {
    expect(needsTwoFactor("team_member", "aal1", "aal1")).toBe(false);
    expect(needsTwoFactor("team_member", "aal1", "aal2")).toBe(true);
    expect(needsTwoFactor("team_member", "aal2", "aal2")).toBe(false);
  });
});
