import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Order } from "@prisma/client";
import { isLocale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { syncOrderPaymentStatus, type MolliePaymentMeasurement } from "@/lib/orders";
import { buildGoogleAnalyticsPurchase } from "@/lib/analytics";
import { formatPrice } from "@/lib/format";
import { checkout as checkoutPath, home, account as accountPath } from "@/lib/routes";
import { Container } from "@/components/ui/Container";
import { OrderStatusEffects } from "@/components/checkout/OrderStatusEffects";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; orderId: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  return {
    title: `${dictionaries[locale].accountOrders.itemsTitle} | De Notenman`,
    robots: { index: false, follow: false },
  };
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ locale: string; orderId: string }>;
}) {
  const { locale, orderId } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = dictionaries[locale];

  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!existing) {
    notFound();
  }

  const observedPayment: { current: MolliePaymentMeasurement | null } = { current: null };
  let order: Order = existing;
  try {
    order = await syncOrderPaymentStatus(existing, {
      onPaymentObserved(payment) {
        observedPayment.current = payment;
      },
    });
  } catch (error) {
    // A temporary Mollie/API failure must not turn the return page into a 500.
    // Keep the persisted state visible; PENDING pages retry automatically.
    console.error(`Could not refresh payment status for order ${existing.id}`, error);
  }

  const view: "PAID" | "PENDING" | "CANCELLED" =
    order.status === "PAID" || order.status === "FULFILLED"
      ? "PAID"
      : order.status === "CANCELLED" || order.status === "REFUNDED"
        ? "CANCELLED"
        : "PENDING";

  const copy = {
    PAID: { title: dictionary.order.paidTitle, body: dictionary.order.paidBody },
    PENDING: { title: dictionary.order.pendingTitle, body: dictionary.order.pendingBody },
    CANCELLED: { title: dictionary.order.cancelledTitle, body: dictionary.order.cancelledBody },
  }[view];

  const paymentMeasurement = observedPayment.current as MolliePaymentMeasurement | null;
  const analyticsMeasurement = order.isTest
    ? undefined
    : {
        transactionId: order.id,
        paymentStatus: paymentMeasurement?.status ?? view.toLowerCase(),
        paymentMethod: paymentMeasurement?.method ?? "unknown",
        ...(view === "PAID"
          ? {
              purchase: buildGoogleAnalyticsPurchase({
                id: order.id,
                currency: order.currency,
                subtotalCents: order.subtotalCents,
                discountCode: order.discountCode,
                discountCents: order.discountCents,
                shippingCents: order.shippingCents,
                items: existing.items,
              }),
            }
          : {}),
      };

  return (
    <main id="main-content">
      <Container className="py-10">
        <OrderStatusEffects status={view} measurement={analyticsMeasurement} />
        <div className="mx-auto max-w-xl text-center">
        <h1 className="text-heading-xl">{copy.title}</h1>
        <p className="mt-3 text-body-lg text-muted">{copy.body}</p>

        <div className="mt-8 rounded-panel border border-border bg-surface p-5 text-left">
          <div className="flex justify-between text-body-sm">
            <span className="text-muted">{dictionary.order.orderNumber}</span>
            <span className="font-mono">{order.id}</span>
          </div>
          <div className="mt-2 flex justify-between font-heading text-heading-sm font-semibold text-text">
            <span>{dictionary.checkout.total}</span>
            <span>{formatPrice(order.totalCents, locale)}</span>
          </div>
        </div>

        {view !== "CANCELLED" ? (
          <p className="mt-4 text-body-sm text-muted">
            {dictionary.accountOrders.confirmationHint}{" "}
            <Link
              href={accountPath(locale)}
              className="font-heading font-semibold text-accent-hover underline underline-offset-4"
            >
              {dictionary.accountOrders.confirmationLinkLabel}
            </Link>
            .
          </p>
        ) : null}

        <div className="mt-8 flex justify-center gap-3">
          {view === "CANCELLED" ? (
            <Link
              href={checkoutPath(locale)}
              className="inline-flex items-center justify-center gap-2 rounded-button border border-accent bg-accent px-6 py-3 font-heading text-body-lg tracking-heading text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover"
            >
              {dictionary.order.tryAgain}
            </Link>
          ) : (
            <Link
              href={home(locale)}
              className="inline-flex items-center justify-center gap-2 rounded-button border border-accent bg-accent px-6 py-3 font-heading text-body-lg tracking-heading text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover"
            >
              {dictionary.order.backToShop}
            </Link>
          )}
        </div>
        </div>
      </Container>
    </main>
  );
}
