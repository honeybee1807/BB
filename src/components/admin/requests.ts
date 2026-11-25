import type { InquiryUpdate } from "@/lib/validation/admin";

export type Result = { ok: true; id?: string } | { ok: false; error: string };

const FALLBACK = "Sorry, that didn't save. Please try again.";

export async function send(url: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<Result> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
    if (res.ok) return { ok: true, id: data?.id };
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

const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];
const UPLOAD_MAX = 15 * 1024 * 1024;

// Sends the file straight to temporary storage, then asks the server to process it.
export async function uploadImage(file: File, finish: (path: string) => Promise<Result>): Promise<Result> {
  if (/\.hei[cf]$/i.test(file.name) || /^image\/hei[cf]/.test(file.type)) {
    return { ok: false, error: `${file.name} is an iPhone HEIC photo. Please save it as a JPEG and try again.` };
  }
  if (!UPLOAD_TYPES.includes(file.type)) return { ok: false, error: `${file.name} is not a JPEG, PNG or WebP image.` };
  if (file.size > UPLOAD_MAX) {
    return { ok: false, error: `${file.name} is over 15 MB. Please make it smaller and try again.` };
  }
  try {
    const res = await fetch("/api/admin/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: file.type, size: file.size }),
    });
    const ticket = (await res.json().catch(() => null)) as { path?: string; url?: string; error?: string } | null;
    if (!res.ok || !ticket?.path || !ticket.url) return { ok: false, error: ticket?.error ?? FALLBACK };
    const put = await fetch(ticket.url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    if (!put.ok) return { ok: false, error: `${file.name} didn't upload. Please try again.` };
    return await finish(ticket.path);
  } catch {
    return { ok: false, error: `${file.name} didn't upload. Please check your connection and try again.` };
  }
}
