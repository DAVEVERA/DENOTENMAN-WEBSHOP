import type { OrderStatus } from "@prisma/client";
import { cn } from "@/lib/cn";

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Openstaand",
  PAID: "Betaald",
  FULFILLED: "Verzonden",
  CANCELLED: "Geannuleerd",
  REFUNDED: "Terugbetaald",
};

// Admin-only UI — this project's design tokens don't define a semantic
// success/danger color, so plain Tailwind color utilities are used here.
const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-green-100 text-green-800",
  FULFILLED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-800",
  REFUNDED: "bg-rose-100 text-rose-800",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-heading font-semibold",
        STATUS_STYLES[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
