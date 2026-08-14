"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearCart } from "@/lib/storefront-state";

export function OrderStatusEffects({ status }: { status: "PAID" | "PENDING" | "CANCELLED" }) {
  const router = useRouter();

  useEffect(() => {
    if (status === "PAID") {
      clearCart();
    }
  }, [status]);

  useEffect(() => {
    if (status !== "PENDING") return;
    const timeout = setTimeout(() => router.refresh(), 4000);
    return () => clearTimeout(timeout);
  }, [status, router]);

  return null;
}
