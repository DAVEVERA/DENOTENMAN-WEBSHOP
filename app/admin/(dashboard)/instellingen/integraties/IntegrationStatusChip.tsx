import type { ProviderStatusState } from "@/lib/provider-status-core";

const STATUS_CLASSES: Record<ProviderStatusState, string> = {
  ready: "border-green-200 bg-green-50 text-green-800",
  attention: "border-amber-200 bg-amber-50 text-amber-900",
  missing: "border-slate-200 bg-slate-50 text-slate-700",
  blocked: "border-red-200 bg-red-50 text-red-800",
  unavailable: "border-violet-200 bg-violet-50 text-violet-800",
};

export function IntegrationStatusChip({ state, label }: { state: ProviderStatusState; label: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-heading font-semibold ${STATUS_CLASSES[state]}`}>
      {label}
    </span>
  );
}
