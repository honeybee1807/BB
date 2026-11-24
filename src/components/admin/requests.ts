import type { InquiryUpdate } from "@/lib/validation/admin";

type Result = { ok: true } | { ok: false; error: string };

const FALLBACK = "Sorry, that didn't save. Please try again.";

async function send(url: string, method: "PATCH" | "POST", body: unknown): Promise<Result> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: data?.error ?? FALLBACK };
  } catch {
    return { ok: false, error: FALLBACK };
  }
}

export function updateInquiry(id: string, change: InquiryUpdate): Promise<Result> {
  return send(`/api/admin/inquiries/${id}`, "PATCH", change);
}

export function changeAvailability(propertyId: string, from: string, to: string, action: "block" | "open") {
  return send("/api/admin/availability", "POST", { propertyId, from, to, action });
}
