import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const pending: Promise<unknown>[] = [];
vi.mock("next/server", () => ({ after: (task: () => Promise<unknown>) => pending.push(task()) }));

const sendSecurityAlert = vi.fn();
vi.mock("@/lib/email/send", () => ({ sendSecurityAlert }));
vi.mock("@/lib/security/audit", () => ({ audit: vi.fn() }));

const deleted = { data: { id: "h1", name: "Sea Breeze Villa" } as unknown, error: null as unknown };
const update = vi.fn();
const supabase = {
  from: () => ({
    update: (values: unknown) => {
      update(values);
      const chain = { eq: () => chain, is: () => chain, select: () => chain, maybeSingle: async () => deleted };
      return chain;
    },
  }),
};
vi.mock("@/lib/admin-route", () => ({
  adminRequest: async () => ({ supabase, identity: { userId: "u1", fullName: "Naseema", role: "owner" }, ipHash: "x" }),
  notFound: () => Response.json({ ok: false }, { status: 404 }),
  dbError: () => Response.json({ ok: false }, { status: 500 }),
  refresh: vi.fn(),
}));

const { DELETE } = await import("./route");

const id = "6f1c7a52-3b0e-4d47-9a4e-2f1b8c9d0e11";
const remove = () =>
  DELETE(new Request(`http://localhost/api/admin/properties/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });

describe("DELETE /api/admin/properties/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pending.length = 0;
    deleted.data = { id: "h1", name: "Sea Breeze Villa" };
  });

  it("soft deletes the home and sends the delete alert", async () => {
    sendSecurityAlert.mockResolvedValue({ sent: true });
    const res = await remove();
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ deleted_at: expect.any(String) });
    await Promise.all(pending);
    expect(sendSecurityAlert).toHaveBeenCalledTimes(1);
    const [kind, email] = sendSecurityAlert.mock.calls[0] as [string, { subject: string; text: string }];
    expect(kind).toBe("property delete");
    expect(email.subject).toContain('Home "Sea Breeze Villa" deleted');
    expect(email.text).toContain("Naseema");
  });

  it("still deletes when the alert email fails", async () => {
    sendSecurityAlert.mockResolvedValue({ sent: false });
    const res = await remove();
    expect(res.status).toBe(200);
    await Promise.all(pending);
    expect(sendSecurityAlert).toHaveBeenCalledTimes(1);
  });

  it("sends no alert when there was nothing to delete", async () => {
    deleted.data = null;
    expect((await remove()).status).toBe(404);
    expect(sendSecurityAlert).not.toHaveBeenCalled();
  });
});
