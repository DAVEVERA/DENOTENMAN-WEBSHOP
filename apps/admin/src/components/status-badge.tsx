import { cn } from "@denotenman/ui";

type ProductStatus = "draft" | "active" | "archived";
type OrderStatus = "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";

type StatusVariant = ProductStatus | OrderStatus;

const productStatusConfig: Record<ProductStatus, { label: string; className: string }> = {
  draft: {
    label: "Concept",
    className: "bg-neutral-100 text-neutral-700 border-neutral-200",
  },
  active: {
    label: "Actief",
    className: "bg-success-light text-success border-success-border",
  },
  archived: {
    label: "Gearchiveerd",
    className: "bg-danger-light text-danger border-danger-border",
  },
};

const orderStatusConfig: Record<OrderStatus, { label: string; className: string }> = {
  pending: {
    label: "In behandeling",
    className: "bg-warning-light text-warning border-warning-border",
  },
  paid: {
    label: "Betaald",
    className: "bg-info-light text-info border-info-border",
  },
  fulfilled: {
    label: "Verzonden",
    className: "bg-success-light text-success border-success-border",
  },
  cancelled: {
    label: "Geannuleerd",
    className: "bg-danger-light text-danger border-danger-border",
  },
  refunded: {
    label: "Terugbetaald",
    className: "bg-purple-50 text-purple-700 border-purple-200",
  },
};

interface StatusBadgeProps {
  status: StatusVariant;
  type: "product" | "order";
  className?: string;
}

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  const lookup =
    type === "product"
      ? (productStatusConfig as Record<string, { label: string; className: string } | undefined>)
      : (orderStatusConfig as Record<string, { label: string; className: string } | undefined>);

  const config = lookup[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
        config?.className ?? "bg-neutral-100 text-neutral-600 border-neutral-200",
        className,
      )}
    >
      {config?.label ?? status}
    </span>
  );
}
