export default function Loading() {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center"
      aria-label="Pagina laden…"
      role="status"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-brand-gold/20 border-t-brand-primary animate-spin" />
        <p className="text-sm font-medium text-brand-primary/60">Laden…</p>
      </div>
    </div>
  );
}
