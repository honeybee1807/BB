import { describe, expect, it } from "vitest";
import { hasPassed } from "@/lib/format";
import { hashInviteToken, newInviteToken } from "@/lib/security/invite-token";
import { acceptFormSchema, acceptInviteSchema, inviteActionSchema, inviteSchema, memberUpdateSchema } from "./team";

describe("invite tokens", () => {
  it("are 43 url-safe characters with a matching 64-character hash", () => {
    const { token, hash } = newInviteToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken(token)).toBe(hash);
  });

  it("are different every time", () => {
    expect(newInviteToken().token).not.toBe(newInviteToken().token);
  });

  it("pass the accept schema", () => {
    const { token } = newInviteToken();
    expect(acceptInviteSchema.safeParse({ token, fullName: "Amina", password: "a long password" }).success).toBe(true);
  });
});

describe("inviteSchema", () => {
  it("trims and lower-cases the email", () => {
    const parsed = inviteSchema.parse({ email: "  Amina@Example.COM ", role: "team_member" });
    expect(parsed.email).toBe("amina@example.com");
  });

  it("rejects an unknown role", () => {
    expect(inviteSchema.safeParse({ email: "a@example.com", role: "admin" }).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(inviteSchema.safeParse({ email: "a@example.com", role: "owner", invitedBy: "x" }).success).toBe(false);
  });

  it("rejects a bad email", () => {
    expect(inviteSchema.safeParse({ email: "not an email", role: "owner" }).success).toBe(false);
  });
});

describe("member and invite changes", () => {
  it("accept a role or an active flag", () => {
    expect(memberUpdateSchema.safeParse({ role: "owner" }).success).toBe(true);
    expect(memberUpdateSchema.safeParse({ active: false }).success).toBe(true);
  });

  it("reject both at once, nothing, or a user id", () => {
    expect(memberUpdateSchema.safeParse({ role: "owner", active: true }).success).toBe(false);
    expect(memberUpdateSchema.safeParse({}).success).toBe(false);
    expect(memberUpdateSchema.safeParse({ role: "owner", userId: "x" }).success).toBe(false);
  });

  it("only resend or cancel invites", () => {
    expect(inviteActionSchema.safeParse({ action: "resend" }).success).toBe(true);
    expect(inviteActionSchema.safeParse({ action: "accept" }).success).toBe(false);
  });
});

describe("accepting an invite", () => {
  const token = "a".repeat(43);

  it("rejects a short password", () => {
    expect(acceptInviteSchema.safeParse({ token, fullName: "Amina", password: "short" }).success).toBe(false);
  });

  it("rejects a malformed token", () => {
    expect(acceptInviteSchema.safeParse({ token: "abc", fullName: "Amina", password: "a long password" }).success).toBe(
      false,
    );
  });

  it("rejects a role sent from the browser", () => {
    expect(
      acceptInviteSchema.safeParse({ token, fullName: "Amina", password: "a long password", role: "owner" }).success,
    ).toBe(false);
  });

  it("asks for matching passwords on the form", () => {
    const result = acceptFormSchema.safeParse({ fullName: "Amina", password: "a long password", confirm: "different" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirm"]);
  });
});

describe("hasPassed", () => {
  const now = new Date("2026-11-25T10:00:00Z");

  it("is true at and after the moment", () => {
    expect(hasPassed("2026-11-25T10:00:00Z", now)).toBe(true);
    expect(hasPassed("2026-11-24T10:00:00Z", now)).toBe(true);
  });

  it("is false before it", () => {
    expect(hasPassed("2026-11-25T10:00:01Z", now)).toBe(false);
  });
});
