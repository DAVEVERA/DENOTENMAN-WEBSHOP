import Link from "next/link";

export type AftersalesFlowSummary = {
  id: string;
  name: string;
  flowType: "PARTICULIER" | "ZAKELIJK";
  isActive: boolean;
  stepCount: number;
  updatedAt: string;
};

const flowTypeBadge: Record<AftersalesFlowSummary["flowType"], { label: string; className: string }> = {
  PARTICULIER: { label: "Particulier", className: "border-blue-300 bg-blue-50 text-blue-900" },
  ZAKELIJK: { label: "Zakelijk", className: "border-amber-300 bg-amber-50 text-amber-950" },
};

export function AftersalesFlowList({ flows }: { flows: AftersalesFlowSummary[] }) {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      {flows.map((flow) => {
        const badge = flowTypeBadge[flow.flowType];
        return (
          <Link
            key={flow.id}
            href={`/admin/marketing/aftersales/${flow.id}`}
            className="block rounded-panel border border-border bg-surface p-5 transition-colors duration-hover-fast hover:border-accent"
          >
            <div className="flex items-center justify-between gap-3">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>
                {badge.label}
              </span>
              <span className={`text-xs font-semibold ${flow.isActive ? "text-emerald-700" : "text-muted"}`}>
                {flow.isActive ? "Actief" : "Inactief"}
              </span>
            </div>
            <h2 className="mt-3 font-heading text-heading-md text-text">{flow.name}</h2>
            <p className="mt-1 text-body-sm text-muted">
              {flow.stepCount} {flow.stepCount === 1 ? "mailstap" : "mailstappen"}
            </p>
            <p className="mt-3 text-xs text-muted">
              Laatst gewijzigd: {new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" }).format(new Date(flow.updatedAt))}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
