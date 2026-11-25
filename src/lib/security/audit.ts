import "server-only";
import type { Json } from "@/types/database";
import { getAdminClient } from "@/lib/supabase/admin";

// Metadata must never hold passwords, tokens, raw emails, raw IPs or guest data.
type AuditAction =
  | "login.ok"
  | "login.failed"
  | "login.lockout"
  | "logout"
  | "logout.idle"
  | "mfa.enrol_started"
  | "mfa.verified"
  | "mfa.failed"
  | "mfa.lockout"
  | "inquiry.status"
  | "inquiry.assign"
  | "inquiry.notes"
  | "availability.block"
  | "availability.open"
  | "region.create"
  | "region.update"
  | "region.delete"
  | "estate.create"
  | "estate.update"
  | "estate.delete"
  | "property.create"
  | "property.update"
  | "property.publish"
  | "property.delete"
  | "photo.add"
  | "photo.update"
  | "photo.order"
  | "photo.delete"
  | "post.create"
  | "post.update"
  | "post.publish"
  | "post.cover"
  | "post.delete"
  | "testimonial.create"
  | "testimonial.update"
  | "testimonial.delete"
  | "team.invite"
  | "team.invite_resend"
  | "team.invite_cancel"
  | "team.join"
  | "team.role"
  | "team.deactivate"
  | "team.reactivate"
  | "team.remove"
  | "seo.update"
  | "seo.image";

type AuditEntry = {
  actorId: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, Json>;
  ipHash?: string;
};

// Never throws, a failed audit write must not break the action.
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const { error } = await getAdminClient()
      .from("audit_log")
      .insert({
        actor_id: entry.actorId,
        action: entry.action,
        entity_type: entry.entityType ?? null,
        entity_id: entry.entityId ?? null,
        metadata: entry.metadata ?? {},
        ip_hash: entry.ipHash ?? null,
      });
    if (error) console.error("[audit] write failed:", error.code);
  } catch {
    console.error("[audit] write failed");
  }
}
