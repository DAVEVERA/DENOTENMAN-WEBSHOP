import {
  getAuditChanges,
  redactAuditTechnicalValue,
} from "@/lib/admin-audit-display";

export function DiffView({
  entityType,
  entityId,
  before,
  after,
}: {
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
}) {
  const changes = getAuditChanges(before, after);

  return (
    <>
      {changes.length === 0 ? (
        <p className="text-body-sm text-muted">Geen zichtbare inhoudelijke wijzigingen.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-body-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 pr-4 font-heading">Veld</th>
                <th className="py-1 pr-4 font-heading">Was</th>
                <th className="py-1 font-heading">Werd</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => (
                <tr key={change.key} className="border-t border-border">
                  <td className="py-1.5 pr-4 font-semibold text-text">{change.label}</td>
                  <td className="break-words py-1.5 pr-4 text-muted">{change.before}</td>
                  <td className="break-words py-1.5 text-text">{change.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="mt-4 rounded-card border border-border bg-background p-3">
        <summary className="cursor-pointer font-heading text-xs font-semibold text-muted">
          Technische details
        </summary>
        <dl className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-[9rem_1fr]">
          <dt>Entiteittype</dt>
          <dd className="break-all font-mono text-text">{entityType}</dd>
          <dt>Technisch ID</dt>
          <dd className="break-all font-mono text-text">{entityId}</dd>
        </dl>
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-button bg-surface p-3 text-xs text-text">
          {JSON.stringify(
            {
              before: redactAuditTechnicalValue(before),
              after: redactAuditTechnicalValue(after),
            },
            null,
            2,
          )}
        </pre>
      </details>
    </>
  );
}
