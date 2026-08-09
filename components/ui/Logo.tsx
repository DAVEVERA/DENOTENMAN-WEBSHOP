import { cn } from "@/lib/cn";

export function Logo({
  alt,
  className,
}: {
  alt: { mark: string; wordmark: string };
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img src="/brand/logo-mark.svg" alt={alt.mark} className="h-8 w-8" />
      <img src="/brand/logo-wordmark.svg" alt={alt.wordmark} className="h-6" />
    </span>
  );
}
