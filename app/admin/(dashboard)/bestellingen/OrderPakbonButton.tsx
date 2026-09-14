"use client";

import { Package } from "lucide-react";

export function OrderPakbonButton({ orderId }: { orderId: string }) {
  return (
    <button
      type="button"
      onClick={() => window.open(`/api/admin/orders/${orderId}/pakbon`, "_blank", "noopener,noreferrer")}
      title="Pakbon printen"
      className="inline-flex h-8 items-center gap-1.5 rounded-button border border-border bg-background px-2.5 text-xs font-semibold text-text transition-colors duration-hover-fast hover:border-border-hover"
    >
      <Package className="h-3.5 w-3.5" aria-hidden="true" />
      Pakbon
    </button>
  );
}
