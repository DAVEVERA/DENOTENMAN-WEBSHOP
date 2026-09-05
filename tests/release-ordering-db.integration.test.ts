import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "../lib/prisma";
import { reserveDiscountUsage, settleDiscountRedemption, discountUsageAvailable, DiscountUsageLimitError } from "../lib/discount-usage";
import { markBusinessOrderListPaid } from "../lib/business-order-checkout";
import { updateBusinessOrderListQuantities } from "../lib/business-order-list-quantities";
import { createBusinessSession, BUSINESS_SESSION_COOKIE } from "../lib/business-portal";
import { POST as requestCancellation } from "../app/api/business/orders/[orderId]/cancellations/route";

function requireLocalQa() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55435");
  assert.equal(url.pathname, "/notenman_release_qa");
}

test("PostgreSQL enforces one email redemption under simultaneous requests and releases only once", async () => {
  requireLocalQa();
  const suffix = randomUUID();
  const email = `${suffix}@example.invalid`;
  const user = await prisma.user.create({ data: { email, name: 'Synthetic QA' } });
  const orderData = { userId: user.id, subtotalCents: 1000, totalCents: 900, discountCents: 100, contactName: 'Synthetic QA', contactEmail: email };
  const orders = await Promise.all([0, 1].map(() => prisma.order.create({ data: orderData })));
  const policy = { code: `qa-${suffix}`, identityScope: 'EMAIL' as const, maxUsesPerIdentity: 1 };
  const identity = { email: ` ${email.toUpperCase()} `, userId: null };
  try {
    const outcomes = await Promise.allSettled(orders.map(order => prisma.$transaction(tx => reserveDiscountUsage(tx, policy, identity, order.id))));
    assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
    const winner = orders[outcomes.findIndex(outcome => outcome.status === 'fulfilled')];
    assert.equal(await discountUsageAvailable(policy, { email, userId: null }), false);
    await Promise.all([0, 1].map(() => prisma.$transaction(tx => settleDiscountRedemption(tx, winner.id, 'RELEASED'))));
    assert.equal(await discountUsageAvailable(policy, { email, userId: null }), true);
    const counter = await prisma.discountUsageCounter.findFirstOrThrow({ where: { code: policy.code } });
    assert.equal(counter.usageCount, 0);
  } finally {
    await prisma.discountRedemption.deleteMany({ where: { orderId: { in: orders.map(order => order.id) } } });
    await prisma.discountUsageCounter.deleteMany({ where: { code: policy.code } });
    await prisma.order.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("legacy paid orders count toward existing codes while multiple-use limits remain configurable", async () => {
  requireLocalQa();
  const suffix = randomUUID();
  const email = `${suffix}@example.invalid`;
  const user = await prisma.user.create({ data: { email, name: 'Synthetic QA' } });
  const policy = { code: `legacy-${suffix}`, identityScope: 'EMAIL' as const, maxUsesPerIdentity: 1 };
  const data = { userId: user.id, subtotalCents: 1000, totalCents: 900, contactName: 'QA', contactEmail: email, discountCode: policy.code };
  const legacy = await prisma.order.create({ data: { ...data, status: 'PAID' } });
  const next = await prisma.order.create({ data });
  const identity = { email: email.toUpperCase(), userId: null };
  try {
    assert.equal(await discountUsageAvailable(policy, identity), false);
    await assert.rejects(prisma.$transaction(tx => reserveDiscountUsage(tx, policy, identity, next.id)), DiscountUsageLimitError);
    await prisma.$transaction(tx => reserveDiscountUsage(tx, { ...policy, maxUsesPerIdentity: 2 }, identity, next.id));
    const counter = await prisma.discountUsageCounter.findFirstOrThrow({ where: { code: policy.code } });
    assert.equal(counter.usageCount, 2, 'one historical use plus one current reservation');
    assert.equal(await discountUsageAvailable({ ...policy, maxUsesPerIdentity: 2 }, identity), false);
    assert.equal(await discountUsageAvailable({ ...policy, maxUsesPerIdentity: null }, identity), true);
  } finally {
    await prisma.discountRedemption.deleteMany({ where: { orderId: next.id } });
    await prisma.discountUsageCounter.deleteMany({ where: { code: policy.code } });
    await prisma.order.deleteMany({ where: { id: { in: [legacy.id, next.id] } } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("paid rounds, partial cancellation requests and later edits preserve reusable list products without email", async () => {
  requireLocalQa();
  const previousEnumWrites = process.env.RELEASE_EXPANDED_ENUM_WRITES;
  const suffix = randomUUID();
  const user = await prisma.user.create({ data: { email: `user-${suffix}@example.invalid`, name: 'Synthetic QA' } });
  const admin = await prisma.adminUser.create({ data: { username: suffix, passwordHash: 'unused', name: 'QA' } });
  const account = await prisma.businessAccount.create({ data: { companyName: 'QA', contactName: 'QA', email: `${suffix}@example.invalid`, status: 'APPROVED' } });
  const list = await prisma.businessOrderList.create({ data: {
    title: 'Synthetic reusable list', businessAccountId: account.id, createdByAdminId: admin.id, status: 'SENT', totalCents: 1000,
    items: { create: [{ productName: 'QA nuts', quantity: 2, unitPriceCents: 500 }, { productName: 'QA extra', quantity: 0, unitPriceCents: 600 }] },
  }, include: { items: true } });
  const order = await prisma.order.create({ data: {
    userId: user.id, businessOrderListId: list.id, status: 'PAID', subtotalCents: 1000, totalCents: 1000, contactName: 'QA', contactEmail: account.email,
    items: { create: { productName: 'QA nuts', variantLabel: '500g', quantity: 2, unitPriceCents: 500 } },
  }, include: { items: true } });
  const session = await prisma.$transaction(tx => createBusinessSession(tx, { businessAccountId: account.id, contactName: 'QA', via: 'test' }));
  const sendRequest = (quantity: number) => requestCancellation(new NextRequest(`http://localhost:3105/api/business/orders/${order.id}/cancellations`, {
    method: 'POST', headers: { origin: 'http://localhost:3105', 'content-type': 'application/json', cookie: `${BUSINESS_SESSION_COOKIE}=${session.sessionToken}` },
    body: JSON.stringify({ items: [{ orderItemId: order.items[0].id, quantity }] }),
  }), { params: Promise.resolve({ orderId: order.id }) });
  try {
    process.env.RELEASE_EXPANDED_ENUM_WRITES = "false";
    await prisma.$transaction(tx => markBusinessOrderListPaid(tx, list.id));
    assert.equal((await sendRequest(1)).status, 201);
    const compatibilityEvent = await prisma.businessEvent.findFirstOrThrow({ where: { orderListId: list.id, summary: { contains: 'vraagt annulering' } } });
    assert.equal(compatibilityEvent.type, 'ORDER_LIST_NOTE_ADDED');
    assert.equal((compatibilityEvent.metadata as { eventType: string }).eventType, 'ORDER_CANCELLATION_REQUESTED');
    assert.equal((await sendRequest(2)).status, 409);
    process.env.RELEASE_EXPANDED_ENUM_WRITES = "true";
    assert.equal((await sendRequest(1)).status, 201);
    assert.equal(await prisma.businessEvent.count({ where: { orderListId: list.id, type: 'ORDER_CANCELLATION_REQUESTED' } }), 1);
    const unchanged = await prisma.businessOrderList.findUniqueOrThrow({ where: { id: list.id }, include: { items: true } });
    assert.equal(unchanged.status, 'SENT');
    assert.deepEqual(unchanged.items.map(item => [item.id, item.quantity]).sort(), list.items.map(item => [item.id, item.quantity]).sort());
    const edited = await updateBusinessOrderListQuantities(account.id, list.id, unchanged.version, list.items.map(item => ({ itemId: item.id, quantity: item.quantity + 1 })));
    assert.equal(edited.ok, true);
    assert.equal(await prisma.emailDeliveryLog.count({ where: { recipientEmail: account.email } }), 0);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, 'PAID');
  } finally {
    if (previousEnumWrites === undefined) delete process.env.RELEASE_EXPANDED_ENUM_WRITES;
    else process.env.RELEASE_EXPANDED_ENUM_WRITES = previousEnumWrites;
    await prisma.businessOrderCancellationRequest.deleteMany({ where: { orderId: order.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.businessAccount.delete({ where: { id: account.id } });
    await prisma.adminUser.delete({ where: { id: admin.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});
