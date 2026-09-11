import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  businessOrderListIsExpired,
  calculateBusinessOrderListTotal,
  hashBusinessToken,
} from "../lib/business-portal-contract";

test("business invitation tokens are stored as stable one-way hashes", () => {
  const token = "private-personal-invitation-token";
  const hashed = hashBusinessToken(token);
  assert.equal(hashed.length, 64);
  assert.notEqual(hashed, token);
  assert.equal(hashed, hashBusinessToken(token));
});

test("business totals are server calculated and bounded to PostgreSQL integer range", () => {
  assert.equal(calculateBusinessOrderListTotal([{ quantity: 3, unitPriceCents: 499 }, { quantity: 2, unitPriceCents: 1000 }]), 3497);
  assert.throws(() => calculateBusinessOrderListTotal([{ quantity: 100_000, unitPriceCents: 100_000_000 }]), /TOTAL_OUT_OF_RANGE/);
  // A quantity of 0 is valid on a continuous order list: it means "on the
  // list, not ordered this round" and contributes nothing to the total.
  assert.equal(calculateBusinessOrderListTotal([{ quantity: 0, unitPriceCents: 100 }]), 0);
  assert.throws(() => calculateBusinessOrderListTotal([{ quantity: -1, unitPriceCents: 100 }]), /INVALID_QUANTITY/);
});

test("business order-list validity expires at the server deadline", () => {
  const now = new Date("2026-08-24T12:00:00.000Z");
  assert.equal(businessOrderListIsExpired(null, now), false);
  assert.equal(businessOrderListIsExpired("2026-08-24T12:00:00.001Z", now), false);
  assert.equal(businessOrderListIsExpired("2026-08-24T12:00:00.000Z", now), true);
  assert.equal(businessOrderListIsExpired("2026-08-24T11:59:59.999Z", now), true);
});

test("portal routes enforce same-origin and tenant scoping", async () => {
  const [checkoutRoute, checkoutService, invitationRoute, sessionService, schema] = await Promise.all([
    readFile("app/api/business/order-lists/[id]/checkout/route.ts", "utf8"),
    readFile("lib/business-order-checkout.ts", "utf8"),
    readFile("app/api/business/auth/accept/route.ts", "utf8"),
    readFile("lib/business-portal.ts", "utf8"),
    readFile("prisma/schema.prisma", "utf8"),
  ]);
  assert.match(checkoutRoute, /isSameOriginMutation/);
  assert.match(checkoutRoute, /session\.businessAccountId/);
  assert.match(checkoutService, /where:\s*{\s*id:\s*orderListId,\s*businessAccountId\s*}/);
  assert.match(invitationRoute, /httpOnly:\s*true/);
  assert.match(invitationRoute, /sameSite:\s*"lax"/);
  assert.match(sessionService, /tokenHash:\s*hashBusinessToken/);
  assert.match(schema, /model BusinessEvent/);
  assert.match(schema, /model BusinessEventRead/);
  assert.match(schema, /model BusinessOrderListItem/);
});

test("the customer can only adjust quantities on an order-list; only Fedor's admin routes can change anything else", async () => {
  const [itemsRoute, adminRoute, quantitiesService, quantitiesRoute] = await Promise.all([
    readFile("app/api/admin/business-accounts/[id]/order-lists/[orderListId]/items/route.ts", "utf8"),
    readFile("app/api/admin/business-accounts/[id]/order-lists/[orderListId]/route.ts", "utf8"),
    readFile("lib/business-order-list-quantities.ts", "utf8"),
    readFile("app/api/business/order-lists/[id]/quantities/route.ts", "utf8"),
  ]);
  assert.match(itemsRoute, /admin\.role === "STAFF"/);
  assert.match(itemsRoute, /VERSION_CONFLICT/);
  assert.match(itemsRoute, /CHECKOUT_IN_PROGRESS/);
  assert.match(adminRoute, /export async function DELETE/);
  assert.match(adminRoute, /existing\.status !== "DRAFT"/);
  // The customer's only write path touches quantity and nothing else on the item row.
  assert.match(quantitiesService, /data:\s*\{\s*quantity\s*\}/);
  assert.match(quantitiesRoute, /getBusinessPortalSession/);
  assert.match(quantitiesRoute, /isSameOriginMutation/);
});

test("business notification reads are isolated per admin and limited to displayed events", async () => {
  const [route, page, inbox, schema] = await Promise.all([
    readFile("app/api/admin/business-events/route.ts", "utf8"),
    readFile("app/admin/(dashboard)/zakelijk/page.tsx", "utf8"),
    readFile("app/admin/(dashboard)/zakelijk/BusinessEventInbox.tsx", "utf8"),
    readFile("prisma/schema.prisma", "utf8"),
  ]);
  assert.match(route, /adminUserId:\s*admin\.id/);
  assert.match(route, /id:\s*\{ in:\s*parsed\.data\.eventIds \}/);
  assert.match(route, /businessEventRead\.createMany/);
  assert.match(page, /adminUserId:\s*session\.userId/);
  assert.match(inbox, /JSON\.stringify\(\{ eventIds \}\)/);
  assert.match(schema, /@@id\(\[businessEventId, adminUserId\]\)/);
});

test("invitation email is delivered via the tracked, retryable transactional-email log", async () => {
  const service = await readFile("lib/business-portal.ts", "utf8");
  const invitationSection = service.slice(service.indexOf("sendBusinessInvitationEmail"), service.indexOf("acceptBusinessInvitation"));
  assert.match(invitationSection, /deliverTransactionalEmail/);
  assert.match(invitationSection, /providerMessageId/);
});

test("order-list emails are only sent by the explicit admin action and remain retryable", async () => {
  const [adminRoute, service, actions] = await Promise.all([
    readFile("app/api/admin/business-accounts/[id]/order-lists/[orderListId]/route.ts", "utf8"),
    readFile("lib/business-portal.ts", "utf8"),
    readFile("app/admin/(dashboard)/zakelijk/[id]/BusinessOrderListActions.tsx", "utf8"),
  ]);
  assert.match(adminRoute, /deliveryStatus:\s*"FAILED"/);
  assert.match(adminRoute, /version:\s*updated\.version/);
  assert.match(service, /business-order-list:\$\{input\.orderListId\}:sent:\$\{input\.version\}/);
  assert.match(actions, /deliveryStatus === "CHANGES_PENDING"/);
  assert.doesNotMatch(
    await readFile("app/api/admin/business-accounts/[id]/order-lists/[orderListId]/items/route.ts", "utf8"),
    /sendBusinessOrderListChangedEmail/
  );
});

test("re-sending a CHANGES_PENDING order list emails the customer the changed-list notice, not the original send", async () => {
  const [adminRoute, service] = await Promise.all([
    readFile("app/api/admin/business-accounts/[id]/order-lists/[orderListId]/route.ts", "utf8"),
    readFile("lib/business-portal.ts", "utf8"),
  ]);
  assert.match(adminRoute, /sendBusinessOrderListChangedEmail/);
  assert.match(adminRoute, /existing\.deliveryStatus === "CHANGES_PENDING"/);
  assert.match(service, /business-order-list:\$\{input\.orderListId\}:changed:\$\{input\.version\}/);
});

test("admin send uses an exclusive delivery claim and cancel targets only the current order", async () => {
  const adminRoute = await readFile("app/api/admin/business-accounts/[id]/order-lists/[orderListId]/route.ts", "utf8");
  assert.match(adminRoute, /deliveryStatus === "SENDING"/);
  assert.match(adminRoute, /deliveryStatus:\s*"PENDING"[\s\S]*data:\s*\{ deliveryStatus:\s*"SENDING" \}/);
  assert.match(adminRoute, /DELIVERY_CLAIM_CONFLICT/);
  assert.match(adminRoute, /status:\s*"SENT", deliveryStatus:\s*"SENDING"/);
  assert.match(adminRoute, /STALE_DELIVERY_CLAIM_MS/);
  assert.match(adminRoute, /emailDeliveryLog\.findUnique/);
  assert.match(adminRoute, /recoveredStatus[\s\S]*"UNKNOWN"/);
  assert.match(adminRoute, /CONFIRM_DELIVERED/);
  assert.match(adminRoute, /CONFIRM_FAILED/);
  assert.match(adminRoute, /existing\.updatedAt\.getTime\(\)/);
  assert.match(adminRoute, /tx\.order\.updateMany/);
  assert.match(adminRoute, /orderListUnchanged:\s*true/);
  assert.doesNotMatch(adminRoute, /data:\s*\{\s*status:\s*"CANCELLED"[\s\S]{0,120}businessOrderList/);
});

test("paid business rounds keep the reusable list quantities and customer cancellations are tenant scoped", async () => {
  const [checkoutService, cancellationRoute, form, migration] = await Promise.all([
    readFile("lib/business-order-checkout.ts", "utf8"),
    readFile("app/api/business/orders/[orderId]/cancellations/route.ts", "utf8"),
    readFile("app/admin/(dashboard)/zakelijk/[id]/bestellijsten/BusinessOrderListForm.tsx", "utf8"),
    readFile("prisma/migrations/20260904214500_business_cancellation_requests/migration.sql", "utf8"),
  ]);
  const paidTransition = checkoutService.slice(checkoutService.indexOf("markBusinessOrderListPaid"), checkoutService.indexOf("export type BusinessCheckoutResult"));
  assert.doesNotMatch(paidTransition, /quantity:\s*0/);
  assert.match(paidTransition, /version:\s*\{ increment:\s*1 \}/);
  assert.match(cancellationRoute, /businessAccountId:\s*session\.businessAccountId/);
  assert.match(cancellationRoute, /TransactionIsolationLevel\.Serializable/);
  assert.match(cancellationRoute, /QUANTITY_EXCEEDS_REMAINING/);
  assert.match(form, /quantity:\s*item\.quantity === 0 \? ""/);
  assert.match(form, /placeholder="Aantal"/);
  assert.match(migration, /WHERE "status" IN \('PAID', 'CANCELLED'\)/);
});

test("the checkout endpoint is guarded by the server-side validity deadline", async () => {
  const checkoutService = await readFile("lib/business-order-checkout.ts", "utf8");
  assert.match(checkoutService, /businessOrderListIsExpired/);
  assert.match(checkoutService, /ORDER_LIST_EXPIRED/);
  // A continuous list is never permanently used up by a payment (see
  // markBusinessOrderListPaid), so there is no more ALREADY_PAID state to
  // guard against here — an empty selection is guarded instead.
  assert.match(checkoutService, /EMPTY_ORDER/);
});

test("admin date input means end of local day and expired lists cannot be created or sent", async () => {
  const [createForm, createRoute, transitionRoute] = await Promise.all([
    readFile("app/admin/(dashboard)/zakelijk/[id]/bestellijsten/BusinessOrderListForm.tsx", "utf8"),
    readFile("app/api/admin/business-accounts/[id]/order-lists/route.ts", "utf8"),
    readFile("app/api/admin/business-accounts/[id]/order-lists/[orderListId]/route.ts", "utf8"),
  ]);
  assert.match(createForm, /23, 59, 59, 999/);
  assert.match(createForm, /min=\{minimumDate\}/);
  assert.match(createRoute, /VALID_UNTIL_IN_PAST/);
  assert.match(transitionRoute, /ORDER_LIST_EXPIRED/);
});

test("business entry screens keep the responsive De Notenman wordmark and noindex contract", async () => {
  const [login, portal] = await Promise.all([
    readFile("app/[locale]/zakelijk/inloggen/page.tsx", "utf8"),
    readFile("app/[locale]/zakelijk/page.tsx", "utf8"),
  ]);
  assert.match(login, /robots:\s*\{ index: false, follow: false \}/);
  assert.match(login, /referrer:\s*"no-referrer"/);
  assert.match(login, /<Logo/);
  assert.match(portal, /<Logo/);
});

test("expired sessions can request an enumeration-safe throttled login link", async () => {
  const [route, service, form, schema, migration] = await Promise.all([
    readFile("app/api/business/auth/request-link/route.ts", "utf8"),
    readFile("lib/business-portal.ts", "utf8"),
    readFile("app/[locale]/zakelijk/inloggen/BusinessLoginLinkRequestForm.tsx", "utf8"),
    readFile("prisma/schema.prisma", "utf8"),
    readFile("prisma/migrations/20260824110000_add_business_customer_portal/migration.sql", "utf8"),
  ]);
  assert.match(route, /status:\s*202/);
  assert.match(route, /Als dit e-mailadres bij een actief zakelijk account hoort/);
  assert.match(route, /isSameOriginMutation/);
  assert.match(route, /after\(async \(\) =>/);
  assert.match(route, /claimBusinessLoginLinkIpAllowance/);
  assert.match(route, /forwarded\.at\(-2\)/);
  assert.match(service, /LOGIN_LINK_ACCOUNT_COOLDOWN_MS = 10 \* 60 \* 1000/);
  assert.match(service, /mode:\s*"insensitive"/);
  assert.match(service, /businessAccount\.updateMany/);
  assert.match(service, /loginLinkRequestedAt:\s*requestedAt/);
  assert.match(service, /claim\.count !== 1/);
  assert.match(service, /ON CONFLICT \("scopeKey"\) DO UPDATE/);
  assert.match(service, /LEAST\("BusinessLoginLinkRateLimit"\."requestCount" \+ 1/);
  assert.match(service, /createHmac\("sha256"/);
  assert.match(schema, /model BusinessLoginLinkRateLimit/);
  assert.match(migration, /CREATE TABLE "BusinessLoginLinkRateLimit"/);
  assert.match(form, /Zakelijk e-mailadres/);
});
