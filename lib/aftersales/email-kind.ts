import { EmailDeliveryKind } from "@prisma/client";
import type { AftersalesTriggerValue } from "@/lib/aftersales/schema";

/**
 * Which kind a flow mail is logged under in the e-mail log. Kept in its own
 * Prisma-client-only module (no `@/lib/prisma`, so no database handshake) to
 * stay unit-testable; lib/aftersales/service.ts re-exports it for its callers.
 *
 * The switch is exhaustive on purpose: a trigger added later fails to compile
 * here instead of silently being logged as a fulfilment mail.
 */
export function aftersalesEmailDeliveryKind(trigger: AftersalesTriggerValue): EmailDeliveryKind {
  switch (trigger) {
    case "BACK_IN_STOCK":
      return EmailDeliveryKind.BACK_IN_STOCK;
    case "REVIEW_REQUEST":
      return EmailDeliveryKind.REVIEW_REQUEST;
    case "ORDER_PAID":
    case "BUSINESS_ORDER_PAID":
      return EmailDeliveryKind.ORDER_CONFIRMATION;
    case "ORDER_FULFILLED":
    case "BUSINESS_ORDER_FULFILLED":
      return EmailDeliveryKind.ORDER_FULFILLED;
  }
}
