import "server-only";
import { createAdminSupabaseClient } from "./supabase/server";

export type AdminAuditLog = {
  id: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string | null;
};

function mapAuditLog(row: any): AdminAuditLog {
  return {
    id: String(row.id),
    actorEmail: row.actor_email ?? null,
    action: String(row.action),
    entityType: String(row.entity_type),
    entityId: row.entity_id ?? null,
    createdAt: row.created_at ?? null,
  };
}

export async function listAuditLogs(limit = 100) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id,actor_email,action,entity_type,entity_id,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAuditLog);
}

export async function createAuditLog(input: {
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("audit_logs").insert({
    actor_email: input.actorEmail ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId === undefined || input.entityId === null ? null : String(input.entityId),
    before_data: input.beforeData ?? null,
    after_data: input.afterData ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) throw new Error(error.message);
}
