import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  businessOrderListIsExpired,
  calculateBusinessOrderListTotal,
  customerCanEditBusinessOrderList,
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
  assert.throws(() => calculateBusinessOrderListTotal([{ quantity: 0, unitPriceCents: 100 }]), /INVALID_QUANTITY/);
});

test("customers can only mutate an active review state", () => {
  assert.equal(customerCanEditBusinessOrderList("SENT"), true);
  assert.equal(customerCanEditBusinessOrderList("CHANGES_REQUESTED"), true);
  assert.equal(customerCanEditBusinessOrderList("DRAFT"), false);
  assert.equal(customerCanEditBusinessOrderList("APPROVED"), false);
  assert.equal(customerCanEditBusinessOrderList("CANCELLED"), false);
});

test("business order-list validity expires at the server deadline", () => {
  const now = new Date("2026-08-24T12:00:00.000Z");
  assert.equal(businessOrderListIsExpired(null, now), false);
  assert.equal(businessOrderListIsExpired("2026-08-24T12:00:00.001Z", now), false);
  assert.equal(businessOrderListIsExpired("2026-08-24T12:00:00.000Z", now), true);
  assert.equal(businessOrderListIsExpired("2026-08-24T11:59:59.999Z", now), true);
});

test("portal routes enforce same-origin, tenant scoping and optimistic versions", async () => {
  const [customerRoute, invitationRoute, sessionService, schema] = await Promise.all([
    readFile("app/api/business/order-lists/[id]/route.ts", "utf8"),
    readFile("app/api/business/auth/accept/route.ts", "utf8"),
    readFile("lib/business-portal.ts", "utf8"),
    readFile("prisma/schema.prisma", "utf8"),
  ]);
  assert.match(customerRoute, /isSameOriginMutation/);
  assert.match(customerRoute, /businessAccountId:\s*session\.businessAccountId/);
  assert.match(customerRoute, /VERSION_CONFLICT/);
  assert.match(invitationRoute, /httpOnly:\s*true/);
  assert.match(invitationRoute, /sameSite:\s*"lax"/);
  assert.match(sessionService, /tokenHash:\s*hashBusinessToken/);
  assert.match(schema, /model BusinessEvent/);
  assert.match(schema, /model BusinessEventRead/);
  assert.match(schema, /model BusinessOrderListItem/);
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

test("invitation secret is not written to the full-body email delivery log", async () => {
  const service = await readFile("lib/business-portal.ts", "utf8");
  const invitationSection = service.slice(service.indexOf("sendBusinessInvitationEmail"), service.indexOf("acceptBusinessInvitation"));
  assert.doesNotMatch(invitationSection, /deliverTransactionalEmail/);
  assert.match(invitationSection, /sendAftersalesMail/);
  assert.match(invitationSection, /providerMessageId/);
});

test("failed order-list emails remain visible and retryable with a new idempotency version", async () => {
  const [adminRoute, service, actions] = await Promise.all([
    readFile("app/api/admin/business-accounts/[id]/order-lists/[orderListId]/route.ts", "utf8"),
    readFile("lib/business-portal.ts", "utf8"),
    readFile("app/admin/(dashboard)/zakelijk/[id]/BusinessOrderListActions.tsx", "utf8"),
  ]);
  assert.match(adminRoute, /deliveryStatus:\s*"FAILED"/);
  assert.match(adminRoute, /existing\.deliveryStatus === "FAILED"/);
  assert.match(adminRoute, /version:\s*updated\.version/);
  assert.match(service, /business-order-list:\$\{input\.orderListId\}:sent:\$\{input\.version\}/);
  assert.match(actions, /deliveryStatus === "FAILED"/);
});

test("admin send and cancel use an exclusive delivery claim", async () => {
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
});

test("every customer mutation is guarded by the server-side validity deadline", async () => {
  const customerRoute = await readFile("app/api/business/order-lists/[id]/route.ts", "utf8");
  assert.match(customerRoute, /ORDER_LIST_EXPIRED/);
  assert.match(customerRoute, /ORDER_LIST_DELIVERY_IN_PROGRESS/);
  assert.match(customerRoute, /status:\s*410/);
  assert.ok((customerRoute.match(/validUntil:\s*\{ gt:\s*now \}/g) ?? []).length >= 3);
  assert.ok((customerRoute.match(/deliveryStatus:\s*\{ not:\s*"SENDING" \}/g) ?? []).length >= 3);
  assert.match(customerRoute, /throwCustomerMutationConflict/);
});

test("admin date input means end of local day and expired lists cannot be created or sent", async () => {
  const [createForm, createRoute, transitionRoute] = await Promise.all([
    readFile("app/admin/(dashboard)/zakelijk/[id]/bestellijsten/nieuw/BusinessOrderListCreateForm.tsx", "utf8"),
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
