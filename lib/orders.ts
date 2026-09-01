import { Locale as MollieLocale } from "@mollie/api-client";
import { prisma } from "@/lib/prisma";
import { getMollieClient } from "@/lib/mollie";
import { BASE_URL } from "@/lib/routes";
import { resolveTranslation } from "@/lib/queries";
import type { Locale } from "@/lib/i18n";
import type { Order, OrderStatus } from "@prisma/client";
import {
  calculateShippingCents,
  calculateTotalWeightGrams,
  isShippingCountryCode,
  type ShippingCountryCode,
} from "@/lib/shipping";
import { sendOrderConfirmationEmail } from "@/lib/mail";
import { sendCompletedTestOrderConfirmation } from "@/lib/test-order-confirmation";
import { sendMerchantNewOrderNotification } from "@/lib/merchant-order-notification";
import {
  prepareAftersalesEvent,
  processAftersalesDelivery,
  processPendingAftersalesForOrder,
  queueAftersalesEvent,
} from "@/lib/aftersales/service";
import { getPickupLocation } from "@/lib/pickup-locations";
import {
  evaluateCheckoutDiscount,
  hasDiscountCode,
  resolvePaymentDisposition,
} from "@/lib/discounts";

export class CheckoutError extends Error {
  constructor(
    public code:
      | "EMPTY_CART"
      | "INVALID_CONTACT"
      | "INVALID_PICKUP_LOCATION"
      | "VARIANT_NOT_FOUND"
      | "VARIANT_INACTIVE"
      | "OUT_OF_STOCK"
      | "INVALID_DISCOUNT_CODE"
      | "DISCOUNT_NOT_ELIGIBLE"
      | "PAYMENT_CREATE_FAILED",
    message: string
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export type CartLineInput = {
  variantId: string;
  quantity: number;
  productSlug?: string;
  variantLabel?: string;
};

type CheckoutVariant = {
  id: string;
  product: { slug: string };
  translations: Array<{ locale: string; label: string }>;
};

export function resolveCheckoutVariant<T extends CheckoutVariant>(
  line: CartLineInput,
  variants: T[],
  locale: Locale
): T | undefined {
  const directMatch = variants.find((variant) => variant.id === line.variantId);
  if (directMatch) return directMatch;

  const productSlug = line.productSlug?.trim().toLocaleLowerCase("nl-NL");
  const variantLabel = line.variantLabel?.trim().toLocaleLowerCase(locale);
  if (!productSlug || !variantLabel) return undefined;

  return variants.find(
    (variant) =>
      variant.product.slug.trim().toLocaleLowerCase("nl-NL") === productSlug &&
      variant.translations.some(
        (translation) =>
          translation.locale === locale &&
          translation.label.trim().toLocaleLowerCase(locale) === variantLabel
      )
  );
}

export type CheckoutContactInput = {
  name: string;
  email: string;
  phone?: string;
  deliveryMethod: "SHIPPING" | "PICKUP";
  pickupLocationId?: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  country: string;
};

const mollieLocaleMap: Record<Locale, MollieLocale> = {
  nl: MollieLocale.nl_NL,
  en: MollieLocale.en_US,
  fr: MollieLocale.fr_FR,
};

function assertNonEmpty(value: string | undefined, field: string) {
  if (!value || value.trim().length === 0) {
    throw new CheckoutError("INVALID_CONTACT", `Missing required field: ${field}`);
  }
}

export function validateContact(contact: CheckoutContactInput) {
  assertNonEmpty(contact.name, "name");
  assertNonEmpty(contact.email, "email");
  assertNonEmpty(contact.country, "country");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
    throw new CheckoutError("INVALID_CONTACT", "Invalid email address");
  }

  if (contact.deliveryMethod === "PICKUP") {
    if (!contact.pickupLocationId) {
      throw new CheckoutError("INVALID_PICKUP_LOCATION", "Missing pickup location");
    }
    const location = getPickupLocation(contact.pickupLocationId);
    if (!location || location.country !== contact.country) {
      throw new CheckoutError("INVALID_PICKUP_LOCATION", "Unknown pickup location for country");
    }
    return;
  }

  if (!isShippingCountryCode(contact.country)) {
    throw new CheckoutError("INVALID_CONTACT", "Shipping is only available in NL and BE");
  }

  assertNonEmpty(contact.street, "street");
  assertNonEmpty(contact.houseNumber, "houseNumber");
  assertNonEmpty(contact.postalCode, "postalCode");
  assertNonEmpty(contact.city, "city");
}

/**
 * Re-prices the cart against the database. Never trust prices, stock, or
 * availability submitted by the client — a tampered request must not be
 * able to change what it pays.
 */
export async function priceCartLines(
  lines: CartLineInput[],
  locale: Locale,
  discountCode?: string,
  hasPreviousPaidOrder = false,
  deliveryMethod: "SHIPPING" | "PICKUP" = "SHIPPING",
  shippingCountry: ShippingCountryCode = "NL"
) {
  if (lines.length === 0) {
    throw new CheckoutError("EMPTY_CART", "Cart is empty");
  }

  const variantIds = [...new Set(lines.map((line) => line.variantId))];
  const fallbackProductSlugs = [
    ...new Set(
      lines
        .map((line) => line.productSlug?.trim())
        .filter((slug): slug is string => Boolean(slug))
    ),
  ];

  const variants = await prisma.productVariant.findMany({
    where:
      fallbackProductSlugs.length > 0
        ? {
            OR: [
              { id: { in: variantIds } },
              { product: { slug: { in: fallbackProductSlugs } } },
            ],
          }
        : { id: { in: variantIds } },
    include: {
      translations: true,
      product: { include: { translations: true } },
    },
  });

  const priced = lines.map((line) => {
    const variant = resolveCheckoutVariant(line, variants, locale);

    if (!variant) {
      throw new CheckoutError("VARIANT_NOT_FOUND", `Variant not found: ${line.variantId}`);
    }
    if (!variant.isActive || !variant.product.isActive) {
      throw new CheckoutError("VARIANT_INACTIVE", `Variant not available: ${line.variantId}`);
    }

    const quantity = Math.max(1, Math.floor(line.quantity));

    // TEMPORARY: stock is not yet tracked for any product (every variant is
    // 0). Until real inventory numbers are imported, skip this check via
    // UNLIMITED_STOCK rather than faking a number into the database.
    // Remove this bypass (and the env var) once stock is populated.
    if (process.env.UNLIMITED_STOCK !== "true" && variant.stock < quantity) {
      throw new CheckoutError(
        "OUT_OF_STOCK",
        `Insufficient stock for variant ${line.variantId}: requested ${quantity}, have ${variant.stock}`
      );
    }

    const productName =
      resolveTranslation(variant.product.translations, locale)?.name ?? variant.product.slug;
    const variantLabel = resolveTranslation(variant.translations, locale)?.label ?? variant.sku;

    return {
      variantId: variant.id,
      productName,
      variantLabel,
      quantity,
      // Action prices are resolved exclusively from the database; the cart's
      // client-side amount is never trusted during checkout.
      unitPriceCents: variant.salePriceCents ?? variant.priceCents,
      weightGrams: variant.weightGrams,
    };
  });

  const subtotalCents = priced.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0
  );
  const totalWeightGrams = calculateTotalWeightGrams(priced);
  const regularShippingCents = calculateShippingCents({
    country: shippingCountry,
    subtotalCents,
    totalWeightGrams,
    deliveryMethod,
  });
  const configuredDiscount = hasDiscountCode(discountCode)
    ? await prisma.discount.findUnique({
        where: { code: discountCode!.trim().toUpperCase() },
        select: {
          code: true,
          status: true,
          percentOff: true,
          amountOffCents: true,
          startsAt: true,
          endsAt: true,
        },
      })
    : null;
  const discountEvaluation = evaluateCheckoutDiscount(
    subtotalCents,
    discountCode,
    hasPreviousPaidOrder,
    process.env.TEST_ORDER_DISCOUNT_CODE,
    configuredDiscount
  );

  if (discountEvaluation.status === "invalid") {
    throw new CheckoutError("INVALID_DISCOUNT_CODE", "Unknown discount code");
  }
  if (discountEvaluation.status === "ineligible") {
    throw new CheckoutError(
      "DISCOUNT_NOT_ELIGIBLE",
      "Discount code is only valid on a first order"
    );
  }

  const discount = discountEvaluation.status === "applied" ? discountEvaluation.discount : null;
  const discountCents = discount?.discountCents ?? 0;
  const isTest = discountEvaluation.status === "applied" && discountEvaluation.isTest;
  const shippingCents = isTest ? 0 : regularShippingCents;

  return {
    lines: priced,
    subtotalCents,
    discountCode: discount?.code ?? null,
    discountCents,
    shippingCents,
    totalWeightGrams,
    totalCents: subtotalCents - discountCents + shippingCents,
    isTest,
  };
}

export async function createOrderWithPayment(
  locale: Locale,
  contact: CheckoutContactInput,
  cartLines: CartLineInput[],
  discountCode?: string
): Promise<{ orderId: string; checkoutUrl: string }> {
  validateContact(contact);
  const normalizedEmail = contact.email.trim().toLocaleLowerCase("nl-NL");
  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    select: { id: true },
  });
  const previousPaidOrder = hasDiscountCode(discountCode)
    ? await prisma.order.findFirst({
        where: {
          isTest: false,
          status: { in: ["PAID", "FULFILLED"] },
          OR: [
            ...(existingUser ? [{ userId: existingUser.id }] : []),
            { contactEmail: { equals: normalizedEmail, mode: "insensitive" as const } },
          ],
        },
        select: { id: true },
      })
    : null;

  const {
    lines,
    subtotalCents,
    discountCode: appliedDiscountCode,
    discountCents,
    shippingCents,
    totalCents,
    isTest,
  } = await priceCartLines(
    cartLines,
    locale,
    discountCode,
    Boolean(previousPaidOrder),
    contact.deliveryMethod,
    isShippingCountryCode(contact.country) ? contact.country : "NL"
  );

  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: { name: contact.name },
      })
    : await prisma.user.upsert({
        where: { email: normalizedEmail },
        update: { name: contact.name },
        create: { email: normalizedEmail, name: contact.name },
      });

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      status: isTest ? "PAID" : "PENDING",
      isTest,
      locale,
      currency: "EUR",
      subtotalCents,
      discountCode: appliedDiscountCode,
      discountCents,
      shippingCents,
      totalCents,
      paidAt: isTest ? new Date() : null,
      contactName: contact.name,
      contactEmail: normalizedEmail,
      contactPhone: contact.phone,
      deliveryMethod: contact.deliveryMethod,
      pickupLocationId: contact.deliveryMethod === "PICKUP" ? contact.pickupLocationId : null,
      shippingStreet: contact.deliveryMethod === "PICKUP" ? null : contact.street,
      shippingHouseNumber: contact.deliveryMethod === "PICKUP" ? null : contact.houseNumber,
      shippingPostalCode: contact.deliveryMethod === "PICKUP" ? null : contact.postalCode,
      shippingCity: contact.deliveryMethod === "PICKUP" ? null : contact.city,
      shippingCountry: contact.country,
      items: {
        create: lines.map((line) => ({
          variantId: line.variantId,
          productName: line.productName,
          variantLabel: line.variantLabel,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
        })),
      },
    },
    include: { items: true },
  });

  if (resolvePaymentDisposition(isTest, totalCents) === "TEST_COMPLETE") {
    await sendCompletedTestOrderConfirmation(order);
    return {
      orderId: order.id,
      checkoutUrl: `${BASE_URL}/${locale}/order/${order.id}`,
    };
  }

  // Mollie requires the webhook URL to be publicly reachable and rejects
  // localhost. In local dev we skip it; the order confirmation page still
  // verifies payment status itself via syncOrderPaymentStatus.
  const isPubliclyReachable = /^https:\/\//.test(BASE_URL);

  try {
    const payment = await getMollieClient().payments.create({
      amount: { currency: "EUR", value: (totalCents / 100).toFixed(2) },
      description: `Bestelling ${order.id} - De Notenman`,
      redirectUrl: `${BASE_URL}/${locale}/order/${order.id}`,
      ...(isPubliclyReachable ? { webhookUrl: `${BASE_URL}/api/webhooks/mollie` } : {}),
      locale: mollieLocaleMap[locale],
      metadata: { orderId: order.id },
    });

    const checkoutUrl = payment.getCheckoutUrl();
    if (!checkoutUrl) {
      throw new CheckoutError("PAYMENT_CREATE_FAILED", "Mollie returned no checkout URL");
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { molliePaymentId: payment.id },
    });

    return { orderId: order.id, checkoutUrl };
  } catch (error) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    if (error instanceof CheckoutError) throw error;
    throw new CheckoutError(
      "PAYMENT_CREATE_FAILED",
      `Failed to create Mollie payment: ${(error as Error).message}`
    );
  }
}

function mapMollieStatusToOrderStatus(mollieStatus: string): OrderStatus | null {
  switch (mollieStatus) {
    case "paid":
      return "PAID";
    case "canceled":
    case "expired":
    case "failed":
      return "CANCELLED";
    default:
      // open, pending, authorized: no change yet, still awaiting the customer/bank.
      return null;
  }
}

export type OrderLookupResult = Order & {
  items: {
    id: string;
    productName: string;
    variantLabel: string;
    quantity: number;
    unitPriceCents: number;
  }[];
};

export type MolliePaymentMeasurement = {
  status: string;
  method: string | null;
};

/**
 * There is no login system — order status is looked up with the order id
 * (shown once on the confirmation page) plus the contact email used at
 * checkout. Both must match, and a mismatch on either looks identical to
 * "not found" so this can't be used to test whether an order id exists.
 */
export async function findOrderForLookup(
  orderId: string,
  email: string
): Promise<OrderLookupResult | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order || order.contactEmail.toLowerCase() !== email.trim().toLowerCase()) {
    return null;
  }

  const synced = await syncOrderPaymentStatus(order);
  return { ...synced, items: order.items };
}

/**
 * The single source of truth for "did this order get paid". Always re-fetches
 * the payment from Mollie using our own API key rather than trusting a
 * webhook body or a client-supplied status — that is the only way to make
 * this un-spoofable.
 */
export async function syncOrderPaymentStatus(
  order: Order,
  options: {
    failOnAftersalesError?: boolean;
    onPaymentObserved?: (payment: MolliePaymentMeasurement) => void;
  } = {}
): Promise<Order> {
  if (order.status === "PAID" || order.status === "FULFILLED") {
    let emailFailure: Error | null = null;
    if (!order.isTest) {
      const results = await processPendingAftersalesForOrder(order.id);
      const failure = results.find((result) => result.status === "failed");
      if (failure?.status === "failed") {
        emailFailure = new Error(`AFTERSALES_DELIVERY_FAILED: ${failure.error}`);
      }
      try {
        await sendMerchantNewOrderNotification(order.id);
      } catch (error) {
        console.error(`Failed to send merchant new-order notification for order ${order.id}`, error);
        emailFailure ??= error instanceof Error ? error : new Error(String(error));
      }
    }
    if (emailFailure && options.failOnAftersalesError) throw emailFailure;

    // The order status remains the source of truth. Provider detail is only
    // supplementary funnel context and must never break an already confirmed
    // order page if Mollie is briefly unavailable.
    if (options.onPaymentObserved && order.molliePaymentId) {
      try {
        const payment = await getMollieClient().payments.get(order.molliePaymentId);
        options.onPaymentObserved({
          status: payment.status,
          method: payment.method ? String(payment.method) : null,
        });
      } catch (error) {
        console.error(`Could not read Mollie measurement for order ${order.id}`, error);
      }
    }
    return order;
  }
  if (!order.molliePaymentId) {
    return order;
  }

  const payment = await getMollieClient().payments.get(order.molliePaymentId);
  options.onPaymentObserved?.({
    status: payment.status,
    method: payment.method ? String(payment.method) : null,
  });
  const nextStatus = mapMollieStatusToOrderStatus(payment.status);

  if (!nextStatus || nextStatus === order.status) {
    return order;
  }

  const prepared = nextStatus === "PAID" && !order.isTest
    ? await prepareAftersalesEvent("ORDER_PAID")
    : null;

  // Persist the status transition and its e-mail event in one transaction.
  // A crash after this commit leaves a PENDING outbox row that a subsequent
  // Mollie webhook or order lookup can resume safely.
  const transition = await prisma.$transaction(async (transaction) => {
    const { count } = await transaction.order.updateMany({
      where: { id: order.id, status: order.status },
      data: {
        status: nextStatus,
        paidAt: nextStatus === "PAID" ? new Date() : order.paidAt,
      },
    });
    const queued =
      count === 1 && nextStatus === "PAID" && prepared
        ? await queueAftersalesEvent(
            transaction,
            order.id,
            "ORDER_PAID",
            prepared
          )
        : null;
    const updated = await transaction.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true },
    });
    return { count, queued, updated };
  });

  if (transition.count === 1 && nextStatus === "PAID") {
    let emailFailure: Error | null = null;
    try {
      if (transition.queued) {
        const result = await processAftersalesDelivery(transition.queued.deliveryId);
        if (result.status === "failed" && options.failOnAftersalesError) {
          throw new Error(`AFTERSALES_DELIVERY_FAILED: ${result.error}`);
        }
      } else {
        // Compatibility fallback for a database on which the aftersales
        // migration is not installed yet. The normal production path above
        // always uses the durable outbox.
        await sendOrderConfirmationEmail(transition.updated, transition.updated.items);
      }
    } catch (error) {
      console.error(`Failed to send order confirmation email for order ${order.id}`, error);
      emailFailure = error instanceof Error ? error : new Error(String(error));
    }
    if (!transition.updated.isTest) {
      try {
        await sendMerchantNewOrderNotification(transition.updated.id);
      } catch (error) {
        console.error(
          `Failed to send merchant new-order notification for order ${order.id}`,
          error
        );
        emailFailure ??= error instanceof Error ? error : new Error(String(error));
      }
    }
    if (emailFailure && options.failOnAftersalesError) throw emailFailure;
  }

  return transition.updated;
}
