import type { ReactNode } from "react";
import { CheckoutSummary } from "./CheckoutSummary";

export function CheckoutLayout({ children }: { children: ReactNode }) {
  return (
    <section className="container checkout-layout">
      <div>{children}</div>
      <CheckoutSummary />
    </section>
  );
}
