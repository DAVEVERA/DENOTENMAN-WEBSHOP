export default function Loading() {
  return (
    <div className="bg-surface min-h-screen pb-24">
      {/* Category hero skeleton */}
      <div className="bg-brand-primary/10 animate-pulse py-16">
        <div className="container-shop">
          <div className="h-4 w-32 rounded bg-brand-primary/20 mb-6" />
          <div className="h-10 w-64 rounded bg-brand-primary/20 mb-4" />
          <div className="h-5 w-96 rounded bg-brand-primary/20" />
        </div>
      </div>

      <div className="container-shop mt-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square rounded-2xl bg-neutral-200 mb-3" />
              <div className="h-4 rounded bg-neutral-200 mb-2" />
              <div className="h-3 rounded bg-neutral-200 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
