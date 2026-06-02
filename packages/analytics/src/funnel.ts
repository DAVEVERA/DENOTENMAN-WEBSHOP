export const checkoutFunnelSteps = [
  "product_viewed",
  "cart_opened",
  "checkout_started",
  "payment_started",
  "order_completed",
] as const;

export type CheckoutFunnelStep = (typeof checkoutFunnelSteps)[number];

export function getFunnelStepIndex(step: CheckoutFunnelStep) {
  return checkoutFunnelSteps.indexOf(step);
}
