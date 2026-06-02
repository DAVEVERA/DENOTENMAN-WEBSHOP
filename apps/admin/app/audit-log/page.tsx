import { listAuditLogs } from "../../lib/audit";
import { formatAdminDate } from "../../lib/orders";

export default async function AuditLogPage() {
  const logs = await listAuditLogs();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Beveiliging</p>
        <h1>Audit log</h1>
        <span>Bekijk belangrijke wijzigingen en beheeracties binnen de adminomgeving.</span>
      </section>

      <section className="admin-list">
        {logs.length === 0 ? <p>Geen audit logs gevonden.</p> : null}
        {logs.map((log) => (
          <article key={log.id} className="admin-list-row">
            <div>
              <h2>{log.action}</h2>
              <p>{log.actorEmail ?? "Systeem"} - {log.entityType}{log.entityId ? ` ${log.entityId}` : ""}</p>
            </div>

            <span>{formatAdminDate(log.createdAt)}</span>
          </article>
        ))}
      </section>
    </main>
  );
}
