import { Sparkles } from "lucide-react";

export function ProductPromotionCallout({ text }: { text: string }) {
  return (
    <aside className="mt-4 flex items-start gap-2 rounded-button border border-accent/40 bg-accent/10 px-3 py-2.5 text-body-sm font-semibold text-text">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent-hover" aria-hidden="true" />
      <span>{text}</span>
    </aside>
  );
}
