import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createElement } from "react";
import { render } from "react-email";
import { EmailDeliveryKind, type BusinessActorType, type BusinessEventType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BASE_URL } from "@/lib/routes";
import { deliverTransactionalEmail, type TransactionalEmailResult } from "@/lib/transactional-email";
import { BusinessInvitationEmail } from "@/emails/BusinessInvitationEmail";
import { BusinessOrderListReadyEmail } from "@/emails/BusinessOrderListReadyEmail";
import { BusinessOrderListChangedEmail } from "@/emails/BusinessOrderListChangedEmail";
import { formatPrice } from "@/lib/format";

export { BUSINESS_SESSION_COOKIE, BUSINESS_SESSION_TTL_SECONDS, hashBusinessToken } from "@/lib/business-portal-contract";
import { BUSINESS_SESSION_COOKIE, BUSINESS_SESSION_TTL_SECONDS, hashBusinessToken } from "@/lib/business-portal-contract";
const INVITATION_TTL_MS = 1000 * 60 * 60 * 72;
const LOGIN_LINK_ACCOUNT_COOLDOWN_MS = 10 * 60 * 1000;
const LOGIN_LINK_IP_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LINK_IP_MAX_REQUESTS = 5;

export class BusinessPortalError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "BusinessPortalError";
  }
}

function newOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Creates a new BusinessSession + records the PORTAL_LOGIN event, shared by
 * every login method (invitation link, password, Google). Callers still set
 * the session cookie on the response themselves via businessSessionCookieOptions.
 */
export async function createBusinessSession(
  tx: Prisma.TransactionClient,
  input: { businessAccountId: string; contactName: string; via: string }
): Promise<{ sessionToken: string; expiresAt: Date }> {
  const sessionToken = newOpaqueToken();
  const sessionTokenHash = hashBusinessToken(sessionToken);
  const expiresAt = new Date(Date.now() + BUSINESS_SESSION_TTL_SECONDS * 1000);
  await tx.businessSession.create({
    data: { businessAccountId: input.businessAccountId, tokenHash: sessionTokenHash, expiresAt },
  });
  await recordBusinessEvent(tx, {
    businessAccountId: input.businessAccountId,
    type: "PORTAL_LOGIN",
    actorType: "CUSTOMER",
    actorName: input.contactName,
    summary: `${input.contactName} heeft ingelogd via ${input.via}`,
  });
  return { sessionToken, expiresAt };
}

export async function recordBusinessEvent(
  tx: Prisma.TransactionClient,
  input: {
    businessAccountId: string;
    orderListId?: string;
    type: BusinessEventType;
    actorType: BusinessActorType;
    actorName: string;
    summary: string;
    metadata?: Prisma.InputJsonValue;
  }
) {
  return tx.businessEvent.create({
    data: {
      businessAccountId: input.businessAccountId,
      orderListId: input.orderListId,
      type: input.type,
      actorType: input.actorType,
      actorName: input.actorName,
      summary: input.summary,
      metadata: input.metadata,
    },
  });
}

export async function createBusinessInvitation(input: {
  businessAccountId: string;
  adminUserId?: string;
  adminName: string;
}) {
  const token = newOpaqueToken();
  const tokenHash = hashBusinessToken(token);
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  const invitation = await prisma.$transaction(async (tx) => {
    const account = await tx.businessAccount.findUnique({ where: { id: input.businessAccountId } });
    if (!account) throw new BusinessPortalError("ACCOUNT_NOT_FOUND", "Zakelijk account niet gevonden.");
    if (account.status !== "APPROVED") {
      throw new BusinessPortalError("ACCOUNT_NOT_APPROVED", "Keur het zakelijke account eerst goed.");
    }

    await tx.businessInvitation.updateMany({
      where: {
        businessAccountId: account.id,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    const created = await tx.businessInvitation.create({
      data: {
        businessAccountId: account.id,
        email: account.email.toLowerCase(),
        tokenHash,
        expiresAt,
        createdByAdminId: input.adminUserId,
      },
    });

    return { invitation: created, account };
  });

  return { ...invitation, token };
}

function acceptedOrPending(result: TransactionalEmailResult): boolean {
  if (result.status === "accepted" || result.status === "pending") return true;
  return result.status === "duplicate" && result.deliveryStatus !== "FAILED";
}

export async function sendBusinessInvitationEmail(input: {
  invitationId: string;
  token: string;
  account: { id: string; companyName: string; contactName: string; email: string };
  adminName: string;
  actorType?: "ADMIN" | "SYSTEM";
}): Promise<{ status: "accepted"; providerMessageId: string } | { status: "failed"; error: string }> {
  const invitationUrl = new URL("/nl/zakelijk/inloggen", BASE_URL);
  invitationUrl.searchParams.set("token", input.token);
  const url = invitationUrl.toString();
  const preview = `${input.adminName} heeft een zakelijke omgeving voor ${input.account.companyName} klaargezet`;
  try {
    const html = await render(createElement(BusinessInvitationEmail, {
      preview,
      contactName: input.account.contactName,
      companyName: input.account.companyName,
      invitationUrl: url,
    }));
    const text = [
      `Beste ${input.account.contactName},`,
      "",
      `${input.adminName} heeft voor ${input.account.companyName} een zakelijke omgeving klaargezet.`,
      "",
      `Open de omgeving: ${url}`,
      "",
      "Deze persoonlijke link is 72 uur geldig en kan eenmaal worden gebruikt.",
    ].join("\n");

    const result = await deliverTransactionalEmail({
      idempotencyKey: `business-invitation:${input.invitationId}`,
      kind: EmailDeliveryKind.BUSINESS_INVITATION,
      recipientEmail: input.account.email,
      recipientName: input.account.contactName,
      subject: "Uitnodiging voor de zakelijke omgeving van De Notenman",
      html,
      text,
    });
    if (!acceptedOrPending(result)) {
      const message = result.status === "failed" ? result.error : `E-mail niet geaccepteerd (${result.status})`;
      await prisma.businessInvitation.update({ where: { id: input.invitationId }, data: { deliveryStatus: "FAILED", deliveryError: message.slice(0, 2000) } });
      return { status: "failed", error: message };
    }
    const providerMessageId = result.status === "accepted" ? result.providerMessageId : "";
    await prisma.$transaction(async (tx) => {
      await tx.businessInvitation.update({ where: { id: input.invitationId }, data: { deliveryStatus: "ACCEPTED", providerMessageId, deliveryError: null } });
      await recordBusinessEvent(tx, {
        businessAccountId: input.account.id,
        type: "INVITATION_SENT",
        actorType: input.actorType ?? "ADMIN",
        actorName: input.adminName,
        summary: `Uitnodiging verstuurd naar ${input.account.email}`,
        metadata: { invitationId: input.invitationId },
      });
    });
    return { status: "accepted", providerMessageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende verzendfout";
    await prisma.businessInvitation.update({ where: { id: input.invitationId }, data: { deliveryStatus: "FAILED", deliveryError: message.slice(0, 2000) } });
    return { status: "failed", error: message };
  }
}

export async function requestBusinessLoginLink(emailCandidate: string): Promise<void> {
  const email = emailCandidate.trim().toLowerCase();
  if (!email || email.length > 320) return;
  const account = await prisma.businessAccount.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, status: "APPROVED" },
  });
  if (!account) return;

  const requestedAt = new Date();
  const cooldownSince = new Date(requestedAt.getTime() - LOGIN_LINK_ACCOUNT_COOLDOWN_MS);
  const claim = await prisma.businessAccount.updateMany({
    where: {
      id: account.id,
      status: "APPROVED",
      OR: [
        { loginLinkRequestedAt: null },
        { loginLinkRequestedAt: { lt: cooldownSince } },
      ],
    },
    data: { loginLinkRequestedAt: requestedAt },
  });
  if (claim.count !== 1) return;

  try {
    const created = await createBusinessInvitation({
      businessAccountId: account.id,
      adminName: "De Notenman",
    });
    const delivery = await sendBusinessInvitationEmail({
      invitationId: created.invitation.id,
      token: created.token,
      account: created.account,
      adminName: "De Notenman",
      actorType: "SYSTEM",
    });
    if (delivery.status !== "failed") return;
  } catch (error) {
    console.error("Business login link creation failed", { businessAccountId: account.id, error });
  }
  await prisma.businessAccount.updateMany({
    where: { id: account.id, loginLinkRequestedAt: requestedAt },
    data: { loginLinkRequestedAt: null },
  });
}

function businessLoginRateLimitSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured");
  return secret;
}

function hashBusinessRateLimitScope(scope: string): string {
  return createHmac("sha256", businessLoginRateLimitSecret()).update(scope, "utf8").digest("hex");
}

async function claimBusinessRateLimitAllowance(scope: string, maxRequests: number, windowMs: number): Promise<boolean> {
  const scopeKey = hashBusinessRateLimitScope(scope);
  const now = new Date();
  const resetBefore = new Date(now.getTime() - windowMs);
  await prisma.businessLoginLinkRateLimit.deleteMany({
    where: { updatedAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
  });
  const rows = await prisma.$queryRaw<Array<{ requestCount: number }>>`
    INSERT INTO "BusinessLoginLinkRateLimit" ("scopeKey", "windowStartedAt", "requestCount", "updatedAt")
    VALUES (${scopeKey}, ${now}, 1, ${now})
    ON CONFLICT ("scopeKey") DO UPDATE SET
      "windowStartedAt" = CASE
        WHEN "BusinessLoginLinkRateLimit"."windowStartedAt" <= ${resetBefore} THEN ${now}
        ELSE "BusinessLoginLinkRateLimit"."windowStartedAt"
      END,
      "requestCount" = CASE
        WHEN "BusinessLoginLinkRateLimit"."windowStartedAt" <= ${resetBefore} THEN 1
        ELSE LEAST("BusinessLoginLinkRateLimit"."requestCount" + 1, ${maxRequests + 1})
      END,
      "updatedAt" = ${now}
    RETURNING "requestCount"
  `;
  return (rows[0]?.requestCount ?? maxRequests + 1) <= maxRequests;
}

export async function claimBusinessLoginLinkIpAllowance(clientAddressCandidate: string): Promise<boolean> {
  const clientAddress = clientAddressCandidate.trim().slice(0, 128) || "unknown";
  return claimBusinessRateLimitAllowance(`business-login-link:ip:${clientAddress}`, LOGIN_LINK_IP_MAX_REQUESTS, LOGIN_LINK_IP_WINDOW_MS);
}

const PASSWORD_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const PASSWORD_LOGIN_IP_MAX_REQUESTS = 20;
const PASSWORD_LOGIN_EMAIL_MAX_REQUESTS = 8;

/**
 * Throttles password-login attempts on two axes at once: per source IP (a
 * generous ceiling — mainly to blunt a single client hammering many
 * accounts) and per target email (a tight ceiling — the actual brute-force
 * defense for one account). Both must allow the attempt.
 */
export async function claimBusinessPasswordLoginAllowance(clientAddressCandidate: string, emailCandidate: string): Promise<boolean> {
  const clientAddress = clientAddressCandidate.trim().slice(0, 128) || "unknown";
  const email = emailCandidate.trim().toLowerCase().slice(0, 320) || "unknown";
  const ipOk = await claimBusinessRateLimitAllowance(`business-password-login:ip:${clientAddress}`, PASSWORD_LOGIN_IP_MAX_REQUESTS, PASSWORD_LOGIN_WINDOW_MS);
  const emailOk = await claimBusinessRateLimitAllowance(`business-password-login:email:${email}`, PASSWORD_LOGIN_EMAIL_MAX_REQUESTS, PASSWORD_LOGIN_WINDOW_MS);
  return ipOk && emailOk;
}

export async function acceptBusinessInvitation(token: string) {
  if (token.length < 32 || token.length > 200) {
    throw new BusinessPortalError("INVITATION_INVALID", "De uitnodigingslink is ongeldig.");
  }

  const tokenHash = hashBusinessToken(token);
  let sessionToken = "";
  let expiresAt = new Date();

  const account = await prisma.$transaction(async (tx) => {
    const invitation = await tx.businessInvitation.findUnique({
      where: { tokenHash },
      include: { businessAccount: true },
    });
    if (
      !invitation ||
      invitation.revokedAt ||
      invitation.acceptedAt ||
      invitation.expiresAt <= new Date()
    ) {
      throw new BusinessPortalError("INVITATION_INVALID", "Deze uitnodiging is ongeldig of verlopen.");
    }
    if (invitation.businessAccount.status !== "APPROVED") {
      throw new BusinessPortalError("ACCOUNT_UNAVAILABLE", "Dit zakelijke account is niet beschikbaar.");
    }

    const claimed = await tx.businessInvitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { acceptedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new BusinessPortalError("INVITATION_INVALID", "Deze uitnodiging is al gebruikt.");
    }

    const session = await createBusinessSession(tx, {
      businessAccountId: invitation.businessAccountId,
      contactName: invitation.businessAccount.contactName,
      via: "uitnodigingslink",
    });
    sessionToken = session.sessionToken;
    expiresAt = session.expiresAt;
    return invitation.businessAccount;
  });

  return { account, sessionToken, expiresAt };
}

export async function getBusinessPortalSession(token?: string | null) {
  const resolvedToken = token ?? (await cookies()).get(BUSINESS_SESSION_COOKIE)?.value;
  if (!resolvedToken) return null;
  const now = new Date();
  const session = await prisma.businessSession.findUnique({
    where: { tokenHash: hashBusinessToken(resolvedToken) },
    include: { businessAccount: true },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= now ||
    session.businessAccount.status !== "APPROVED"
  ) {
    return null;
  }

  if (session.lastSeenAt.getTime() < Date.now() - 5 * 60 * 1000) {
    await prisma.businessSession.update({ where: { id: session.id }, data: { lastSeenAt: now } }).catch(() => undefined);
  }
  return session;
}

export async function revokeBusinessSession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await prisma.businessSession.updateMany({
    where: { tokenHash: hashBusinessToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

type BusinessOrderListEmailItem = { productName: string; variantLabel: string | null; quantity: number; unitPriceCents: number };

function toEmailLineItems(items: BusinessOrderListEmailItem[]) {
  return items.map((item) => ({
    name: item.variantLabel ? `${item.productName} (${item.variantLabel})` : item.productName,
    quantity: item.quantity,
    lineTotal: formatPrice(item.unitPriceCents * item.quantity, "nl"),
  }));
}

export async function sendBusinessOrderListEmail(input: {
  orderListId: string;
  version: number;
  title: string;
  validUntil: Date | null;
  items: BusinessOrderListEmailItem[];
  totalCents: number;
  account: { companyName: string; contactName: string; email: string };
}): Promise<TransactionalEmailResult> {
  const portalUrl = new URL("/nl/zakelijk", BASE_URL).toString();
  const items = toEmailLineItems(input.items);
  const total = formatPrice(input.totalCents, "nl");
  const validUntil = input.validUntil
    ? new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" }).format(input.validUntil)
    : null;
  const preview = `Nieuwe bestellijst van De Notenman klaar om te bekijken`;
  const html = await render(createElement(BusinessOrderListReadyEmail, {
    preview,
    contactName: input.account.contactName,
    companyName: input.account.companyName,
    title: input.title,
    validUntil,
    items,
    total,
    portalUrl,
  }));
  const text = [
    `Beste ${input.account.contactName},`,
    "",
    `Fedor heeft de bestellijst "${input.title}" voor ${input.account.companyName} klaargezet.`,
    "",
    ...items.map((item) => `${item.quantity}x ${item.name} - ${item.lineTotal}`),
    "",
    `Totaal (excl. BTW): ${total}`,
    "",
    `Bekijk en reken af: ${portalUrl}`,
    "",
    "Wijzigen kan alleen via Fedor - vanuit hier reken je direct af.",
  ].join("\n");

  return deliverTransactionalEmail({
    idempotencyKey: `business-order-list:${input.orderListId}:sent:${input.version}`,
    kind: EmailDeliveryKind.BUSINESS_ORDER_LIST,
    recipientEmail: input.account.email,
    recipientName: input.account.contactName,
    subject: `Nieuwe bestellijst van De Notenman: ${input.title}`,
    html,
    text,
  });
}

export async function sendBusinessOrderListChangedEmail(input: {
  orderListId: string;
  version: number;
  title: string;
  items: BusinessOrderListEmailItem[];
  totalCents: number;
  account: { companyName: string; contactName: string; email: string };
}): Promise<TransactionalEmailResult> {
  const portalUrl = new URL("/nl/zakelijk", BASE_URL).toString();
  const items = toEmailLineItems(input.items);
  const total = formatPrice(input.totalCents, "nl");
  const changedDate = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const preview = "Je bestellijst bij De Notenman is aangepast";
  const html = await render(createElement(BusinessOrderListChangedEmail, {
    preview,
    contactName: input.account.contactName,
    companyName: input.account.companyName,
    title: input.title,
    changedDate,
    items,
    total,
    portalUrl,
  }));
  const text = [
    `Beste ${input.account.contactName},`,
    "",
    `Fedor heeft wijzigingen doorgevoerd in "${input.title}" voor ${input.account.companyName}.`,
    "",
    ...items.map((item) => `${item.quantity}x ${item.name} - ${item.lineTotal}`),
    "",
    `Nieuw totaal (excl. BTW): ${total}`,
    "",
    `Bekijk de gewijzigde lijst en reken af: ${portalUrl}`,
  ].join("\n");

  return deliverTransactionalEmail({
    idempotencyKey: `business-order-list:${input.orderListId}:changed:${input.version}`,
    kind: EmailDeliveryKind.BUSINESS_ORDER_LIST_CHANGED,
    recipientEmail: input.account.email,
    recipientName: input.account.contactName,
    subject: `Je bestellijst bij De Notenman is aangepast: ${input.title}`,
    html,
    text,
  });
}
