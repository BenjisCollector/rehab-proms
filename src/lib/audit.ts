import { getDb } from "./db";

export type AuditAction = "login" | "logout" | "list" | "read" | "create" | "update" | "export";
export type AuditOutcome = "success" | "denied" | "failure";

export interface Actor {
  id: string | null;
  role: string | null;
}

/**
 * Record one access event. Never pass clinical content or free text here: the
 * audit log holds who, what, when and outcome only (data minimisation, see DPIA note).
 */
export function audit(
  actor: Actor,
  action: AuditAction,
  resourceType: string,
  resourceId: string | null,
  outcome: AuditOutcome = "success",
) {
  getDb()
    .prepare(
      `INSERT INTO audit_log (at, actor_id, actor_role, action, resource_type, resource_id, outcome)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(new Date().toISOString(), actor.id, actor.role, action, resourceType, resourceId, outcome);
}

export interface AuditRow {
  id: number;
  at: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  outcome: string;
}

export function recentAudit(limit = 200): AuditRow[] {
  return getDb().prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?").all(limit) as AuditRow[];
}
