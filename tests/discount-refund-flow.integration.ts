import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { priceCartLines } from "../lib/orders";
import {
  createOrderRefund,
  syncOrderRefundStatuses,
  type OrderRefundProvider,
} from "../lib/order-refund-service";

const integrationDatabaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://invalid");
if (
  !["localhost", "127.0.0.1"].includes(integrationDatabaseUrl.hostname) ||
  process.env.ALLOW_LOCAL_INTEGRATION_TEST !== "1"
) {
  throw new Error("Refusing integration test outside the temporary localhost database.");
}

const ids = {
  admin: "refund-integration-admin",
  user: "refund-integration-user",
  product: "refund-integration-product",
  variant: "refund-integration-variant",
  order: "refund-integration-order",
};

async function cleanup() {
  await prisma.orderRefundItem.deleteMany({ where: { refund: { orderId: ids.order } } });
  await prisma.orderRefund.deleteMany({ where: { orderId: ids.order } });
  await prisma.orderItem.deleteMany({ where: { orderId: ids.order } });
  await prisma.order.deleteMany({ where: { id: ids.order } });
  await prisma.user.deleteMany({ where: { id: ids.user } });
  await prisma.variantTranslation.deleteMany({ where: { variantId: ids.variant } });
  await prisma.productVariant.deleteMany({ where: { id: ids.variant } });
  await prisma.productTranslation.deleteMany({ where: { productId: ids.product } });
  await prisma.product.deleteMany({ where: { id: ids.product } });
  await prisma.discount.deleteMany({ where: { code: "INTEGRATION15" } });
  await prisma.auditLog.deleteMany({ where: { adminUserId: ids.admin } });
  await prisma.adminUser.deleteMany({ where: { id: ids.admin } });
}

async function main() {
  await cleanup();
  const admin = await prisma.adminUser.create({
    data: {
      id: ids.admin,
      username: "refund-integration-admin",
      passwordHash: "integration-only",
      name: "Refund Integration Admin",
      role: "OWNER",
    },
  });
  await prisma.product.create({
    data: {
      id: ids.product,
      slug: "refund-integration-product",
      sku: "REFUND-INTEGRATION-PRODUCT",
      basePriceCents: 5_000,
      translations: {
        create: {
          locale: "nl",
          name: "Integratie noten",
          slug: "refund-integration-product",
        },
      },
      variants: {
        create: {
          id: ids.variant,
          sku: "REFUND-INTEGRATION-VARIANT",
          priceCents: 5_000,
          stock: 10,
          weightGrams: 500,
          preparation: "RAW",
          salting: "UNSALTED",
          translations: { create: { locale: "nl", label: "500 gram" } },
        },
      },
    },
  });
  await prisma.discount.create({
    data: {
      code: "INTEGRATION15",
      title: "Integratiekorting",
      status: "ACTIVE",
      percentOff: 15,
    },
  });

  const priced = await priceCartLines(
    [{ variantId: ids.variant, quantity: 2 }],
    "nl",
    "integration15",
    false,
    "PICKUP"
  );
  assert.equal(priced.discountCode, "INTEGRATION15");
  assert.equal(priced.discountCents, 1_500);
  assert.equal(priced.totalCents, 8_500);

  await prisma.user.create({
    data: { id: ids.user, email: "refund-integration@example.com", name: "Testklant" },
  });
  const order = await prisma.order.create({
    data: {
      id: ids.order,
      userId: ids.user,
      status: "PAID",
      locale: "nl",
      subtotalCents: 10_000,
      discountCode: "INTEGRATION10",
      discountCents: 1_000,
      shippingCents: 695,
      totalCents: 9_695,
      contactName: "Testklant",
      contactEmail: "refund-integration@example.com",
      deliveryMethod: "SHIPPING",
      shippingStreet: "Teststraat",
      shippingHouseNumber: "1",
      shippingPostalCode: "1234 AB",
      shippingCity: "Uden",
      shippingCountry: "NL",
      molliePaymentId: "tr_refund_integration",
      paidAt: new Date(),
      items: {
        create: {
          variantId: ids.variant,
          productName: "Integratie noten",
          variantLabel: "500 gram",
          quantity: 2,
          unitPriceCents: 5_000,
        },
      },
    },
    include: { items: true },
  });
  const orderItemId = order.items[0].id;

  const providerRefunds: Array<{ id: string; status: string; metadata: unknown }> = [];
  let createCalls = 0;
  const provider: OrderRefundProvider = {
    getPayment: async () => ({ status: "paid", amountRemaining: { value: "96.95" } }),
    listPaymentRefunds: async () => providerRefunds,
    createPaymentRefund: async (input) => {
      createCalls += 1;
      const created = {
        id: `re_integration_${createCalls}`,
        status: "pending",
        metadata: input.metadata,
      };
      providerRefunds.push(created);
      return created;
    },
  };

  const firstRequest = {
    orderId: order.id,
    requestId: "5db7c786-8ab5-4f78-bf54-85811d991b5f",
    selections: [{ orderItemId, quantity: 1 }],
    includeShipping: false,
    reason: "Eerste helft geannuleerd",
  };
  const first = await createOrderRefund(firstRequest, admin, provider);
  assert.equal(first.amountCents, 4_500);
  assert.equal(first.status, "PENDING");
  await createOrderRefund(firstRequest, admin, provider);
  assert.equal(createCalls, 1, "same request id must never create a second Mollie refund");

  const second = await createOrderRefund(
    {
      orderId: order.id,
      requestId: "496fb4db-bdd4-4c41-b9c1-3f7c96e01728",
      selections: [{ orderItemId, quantity: 1 }],
      includeShipping: true,
      reason: "Restant en verzendkosten geannuleerd",
    },
    admin,
    provider
  );
  assert.equal(second.amountCents, 5_195);
  assert.equal(first.amountCents + second.amountCents, order.totalCents);
  assert.equal(createCalls, 2);

  for (const refund of providerRefunds) refund.status = "refunded";
  await syncOrderRefundStatuses(order.id, provider);
  const stored = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: { refunds: true },
  });
  assert.equal(stored.status, "REFUNDED");
  assert.equal(stored.refunds.length, 2);
  assert.equal(stored.refunds.reduce((sum, refund) => sum + refund.amountCents, 0), 9_695);

  await cleanup();
  await prisma.$disconnect();
  console.log("discount and partial Mollie refund integration flow passed");
}

main().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
  process.exitCode = 1;
});
