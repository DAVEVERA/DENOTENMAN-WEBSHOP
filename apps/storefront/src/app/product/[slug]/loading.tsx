export default function Loading() {
  return (
    <div className="bg-surface min-h-screen pb-24 animate-pulse">
      <div className="h-48 bg-brand-primary/10 w-full" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-12 lg:pt-20">
        <div className="h-8 w-48 rounded-full bg-neutral-200 mb-10" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-16">
          <div className="lg:col-span-5">
            <div className="aspect-[4/5] rounded-[2rem] bg-neutral-200" />
          </div>
          <div className="lg:col-span-7 flex flex-col gap-6 pt-4">
            <div className="h-6 w-24 rounded-full bg-neutral-200" />
            <div className="h-12 w-80 rounded bg-neutral-200" />
            <div className="h-20 rounded bg-neutral-200" />
            <div className="h-48 rounded-3xl bg-neutral-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
