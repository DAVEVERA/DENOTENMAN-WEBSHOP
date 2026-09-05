import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type BusinessPortalSectionProps = {
  children: ReactNode;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  compact?: boolean;
};

export function BusinessPortalSection({
  children,
  title,
  description,
  defaultOpen = false,
  compact = false,
}: BusinessPortalSectionProps) {
  return (
    <details
      open={defaultOpen}
      className={`group/portal-section overflow-hidden border border-border bg-surface ${compact ? "rounded-card" : "rounded-panel shadow-card"}`}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className={`block font-heading font-bold text-text ${compact ? "text-body-md" : "text-heading-sm"}`}>{title}</span>
          {description ? <span className="mt-0.5 block text-body-sm font-normal text-muted">{description}</span> : null}
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-open/portal-section:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <div className={`border-t border-border ${compact ? "p-4" : "p-4 sm:p-6"}`}>{children}</div>
    </details>
  );
}
