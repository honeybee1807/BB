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
  | "mfa.lockout";

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
