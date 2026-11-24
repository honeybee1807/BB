"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth/admin-session";
import { SEARCH_COOKIE } from "./search";

const searchSchema = z.strictObject({
  q: z.string().trim().max(100),
  back: z.string().regex(/^\?[\w=&%.-]*$|^$/),
});

// Guest names and emails stay out of the URL, where they would reach history and request logs.
export async function searchInquiries(formData: FormData) {
  await requireAdminPage();
  const parsed = searchSchema.safeParse({ q: formData.get("q") ?? "", back: formData.get("back") ?? "" });
  const jar = await cookies();
  if (parsed.success && parsed.data.q) {
    jar.set(SEARCH_COOKIE, parsed.data.q, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/admin/inquiries",
      maxAge: 30 * 60,
    });
  } else {
    jar.delete({ name: SEARCH_COOKIE, path: "/admin/inquiries" });
  }
  redirect(`/admin/inquiries${parsed.success ? parsed.data.back : ""}`);
}
