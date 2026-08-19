import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/cn";
import { RevertButton } from "./RevertButton";
import { DiffView } from "./DiffView";
import { canRevertAuditEntity } from "@/lib/admin-audit";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Aangemaakt",
  UPDATE: "Gewijzigd",
  DELETE: "Verwijderd",
  RESTORE: "Teruggedraaid",
};

export default async function LogboekPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; adminUserId?: string }>;
}) {
  const { entityType, adminUserId } = await searchParams;

  const [entries, entityTypes, adminUsers] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        entityType: entityType || undefined,
        adminUserId: adminUserId || undefined,
      },
      include: { adminUser: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
    prisma.adminUser.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-heading-xl text-text">Revisielogboek</h1>
      <p className="mt-1 text-body-sm text-muted">
        Elke wijziging in het admin portaal, wie het deed en wanneer. Terugdraaien herstelt de vorige staat.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/admin/logboek"
          className={cn(
            "rounded-button border border-border px-3 py-2 font-heading text-body-sm font-semibold transition-colors duration-hover-fast",
            !entityType && !adminUserId
              ? "border-accent bg-accent text-contrast"
              : "bg-surface text-text hover:border-border-hover"
          )}
        >
          Alles
        </Link>
        {entityTypes.map((row) => (
          <Link
            key={row.entityType}
            href={`/admin/logboek?entityType=${row.entityType}`}
            className={cn(
              "rounded-button border border-border px-3 py-2 font-heading text-body-sm font-semibold transition-colors duration-hover-fast",
              entityType === row.entityType
                ? "border-accent bg-accent text-contrast"
                : "bg-surface text-text hover:border-border-hover"
            )}
          >
            {row.entityType}
          </Link>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {adminUsers.map((user) => (
          <Link
            key={user.id}
            href={`/admin/logboek?adminUserId=${user.id}${entityType ? `&entityType=${entityType}` : ""}`}
            className={cn(
              "rounded-button border border-border px-3 py-1.5 font-heading text-xs font-semibold transition-colors duration-hover-fast",
              adminUserId === user.id
                ? "border-accent bg-accent text-contrast"
                : "bg-surface text-muted hover:border-border-hover"
            )}
          >
            {user.name}
          </Link>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="mt-6 text-body-sm text-muted">Geen wijzigingen gevonden.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {entries.map((entry) => (
            <details
              key={entry.id}
              className="rounded-panel border border-border bg-surface px-4 py-3"
            >
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-heading text-body-sm font-semibold text-text">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                  <span className="text-body-sm text-muted">{entry.entityType}</span>
                  <span className="font-mono text-xs text-muted">{entry.entityId.slice(0, 10)}…</span>
                  {entry.reverted ? (
                    <span className="rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-800">
                      Teruggedraaid
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 text-body-sm text-muted">
                  <span>{entry.adminUser.name}</span>
                  <span>
                    {new Intl.DateTimeFormat("nl-NL", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(entry.createdAt)}
                  </span>
                </div>
              </summary>

              <div className="mt-3 border-t border-border pt-3">
                <DiffView before={entry.before} after={entry.after} />

                {!entry.reverted && entry.action !== "RESTORE" && canRevertAuditEntity(entry.entityType) ? (
                  <div className="mt-3 flex justify-end">
                    <RevertButton auditLogId={entry.id} />
                  </div>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
