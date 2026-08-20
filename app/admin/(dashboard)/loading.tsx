import { LoadingIndicator } from "@/components/ui/LoadingIndicator";

export default function AdminDashboardLoading() {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-panel border border-border bg-surface p-6 shadow-card">
      <LoadingIndicator label="Beheeromgeving laden…" size="lg" showLabel className="flex-col font-heading font-bold text-text" />
    </div>
  );
}
