import type { DeveloperInvoiceDto } from "@/lib/developer-portal/service";

export function statusBadgeFor(invoice: Pick<DeveloperInvoiceDto, "status" | "overdue">): { label: string; className: string } {
  if (invoice.status === "DRAFT") return { label: "Concept", className: "bg-border text-text" };
  if (invoice.status === "PAID") return { label: "Betaald", className: "bg-green-100 text-green-800" };
  if (invoice.status === "CANCELLED") return { label: "Geannuleerd", className: "bg-background text-muted line-through" };
  return invoice.overdue ? { label: "Te laat", className: "bg-red-50 text-red-800" } : { label: "Openstaand", className: "bg-amber-100 text-amber-900" };
}
