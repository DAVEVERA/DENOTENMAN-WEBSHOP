export default function AdminDashboardLoading() {
  return (
    <div role="status" aria-live="polite" className="rounded-panel border border-border bg-surface p-6 shadow-card">
      <div className="h-6 w-56 animate-pulse rounded bg-border" />
      <div className="mt-4 h-24 animate-pulse rounded-card bg-background" />
      <p className="sr-only">Beheeromgeving laden…</p>
    </div>
  );
}
