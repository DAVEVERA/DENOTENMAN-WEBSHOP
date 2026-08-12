export default function Loading() {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-neutral-500" role="status">
      <span
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-green-600"
        aria-hidden="true"
      />
      Bezig met laden…
    </div>
  );
}
