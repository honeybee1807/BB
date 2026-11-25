import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/admin-session";

// Testimonials are managed at the bottom of the Journal page.
export default async function TestimonialsPage() {
  await requireAdminPage();
  redirect("/admin/journal#testimonials");
}
