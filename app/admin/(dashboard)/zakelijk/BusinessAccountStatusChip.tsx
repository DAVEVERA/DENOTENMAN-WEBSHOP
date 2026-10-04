import type { BusinessAccountStatus } from "@prisma/client";
import { cn } from "@/lib/cn";

const STATUS_LABELS: Record<BusinessAccountStatus, string> = {
  PENDING: "In afwachting",
  APPROVED: "Goedgekeurd",
  REJECTED: "Afgewezen",
  SUSPENDED: "Geschorst",
};

const STATUS_CLASSES: Record<BusinessAccountStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-900",
  APPROVED: "border-green-200 bg-green-50 text-green-800",
  REJECTED: "border-red-200 bg-red-50 text-red-800",
  SUSPENDED: "border-violet-200 bg-violet-50 text-violet-800",
};

export function BusinessAccountStatusChip({
  status,
  className,
}: {
  status: BusinessAccountStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-heading font-semibold",
        STATUS_CLASSES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
