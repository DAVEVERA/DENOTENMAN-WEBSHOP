import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { EmailDeliveryKind, type BusinessActorType, type BusinessEventType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BASE_URL } from "@/lib/routes";
import { deliverTransactionalEmail, type TransactionalEmailResult } from "@/lib/transactional-email";
import {
  checkTransactionalProviderReadiness,
  sendAftersalesMail,
  TransactionalProviderError,
} from "@/lib/aftersales/provider";

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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

export async function sendBusinessInvitationEmail(input: {
  invitationId: string;
  token: string;
  account: { id: string; companyName: string; contactName: string; email: string };
  adminName: string;
  actorType?: "ADMIN" | "SYSTEM";
}): Promise<{ status: "accepted"; providerMessageId: string } | { status: "failed"; error: string }> {
  const invitationUrl = new URL("/nl/zakelijk/inloggen", BASE_URL);
  invitationUrl.searchParams.set("token", input.token);
  const companyName = escapeHtml(input.account.companyName);
  const contactName = escapeHtml(input.account.contactName);
  const url = invitationUrl.toString();
  try {
    const readiness = await checkTransactionalProviderReadiness();
    if (!readiness.ready) throw new TransactionalProviderError(readiness.message, "PROVIDER_NOT_READY", false);
    const result = await sendAftersalesMail({
      deliveryId: input.invitationId,
      orderId: "",
      trigger: "BUSINESS_INVITATION",
      to: input.account.email.toLowerCase(),
      subject: "Uitnodiging voor de zakelijke omgeving van De Notenman",
      html: `<p>Beste ${contactName},</p><p>${escapeHtml(input.adminName)} heeft voor ${companyName} een zakelijke omgeving klaargezet.</p><p><a href="${escapeHtml(url)}">Open de zakelijke omgeving</a></p><p>Deze persoonlijke link is 72 uur geldig en kan eenmaal worden gebruikt.</p>`,
      text: `Beste ${input.account.contactName},\n\n${input.adminName} heeft voor ${input.account.companyName} een zakelijke omgeving klaargezet.\n\nOpen de omgeving: ${url}\n\nDeze persoonlijke link is 72 uur geldig en kan eenmaal worden gebruikt.`,
    });
    await prisma.$transaction(async (tx) => {
      await tx.businessInvitation.update({ where: { id: input.invitationId }, data: { deliveryStatus: "ACCEPTED", providerMessageId: result.messageId, deliveryError: null } });
      await recordBusinessEvent(tx, {
        businessAccountId: input.account.id,
        type: "INVITATION_SENT",
        actorType: input.actorType ?? "ADMIN",
        actorName: input.adminName,
        summary: `Uitnodiging verstuurd naar ${input.account.email}`,
        metadata: { invitationId: input.invitationId },
      });
    });
    return { status: "accepted", providerMessageId: result.messageId };
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

function hashBusinessLoginRateLimitScope(clientAddress: string): string {
  return createHmac("sha256", businessLoginRateLimitSecret())
    .update(`business-login-link:ip:${clientAddress}`, "utf8")
    .digest("hex");
}

export async function claimBusinessLoginLinkIpAllowance(clientAddressCandidate: string): Promise<boolean> {
  const clientAddress = clientAddressCandidate.trim().slice(0, 128) || "unknown";
  const scopeKey = hashBusinessLoginRateLimitScope(clientAddress);
  const now = new Date();
  const resetBefore = new Date(now.getTime() - LOGIN_LINK_IP_WINDOW_MS);
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
        ELSE LEAST("BusinessLoginLinkRateLimit"."requestCount" + 1, ${LOGIN_LINK_IP_MAX_REQUESTS + 1})
      END,
      "updatedAt" = ${now}
    RETURNING "requestCount"
  `;
  return (rows[0]?.requestCount ?? LOGIN_LINK_IP_MAX_REQUESTS + 1) <= LOGIN_LINK_IP_MAX_REQUESTS;
}

export async function acceptBusinessInvitation(token: string) {
  if (token.length < 32 || token.length > 200) {
    throw new BusinessPortalError("INVITATION_INVALID", "De uitnodigingslink is ongeldig.");
  }

  const tokenHash = hashBusinessToken(token);
  const sessionToken = newOpaqueToken();
  const sessionTokenHash = hashBusinessToken(sessionToken);
  const expiresAt = new Date(Date.now() + BUSINESS_SESSION_TTL_SECONDS * 1000);

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

    await tx.businessSession.create({
      data: {
        businessAccountId: invitation.businessAccountId,
        tokenHash: sessionTokenHash,
        expiresAt,
      },
    });
    await recordBusinessEvent(tx, {
      businessAccountId: invitation.businessAccountId,
      type: "PORTAL_LOGIN",
      actorType: "CUSTOMER",
      actorName: invitation.businessAccount.contactName,
      summary: `${invitation.businessAccount.contactName} heeft de zakelijke omgeving geactiveerd`,
    });
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

export async function sendBusinessOrderListEmail(input: {
  orderListId: string;
  version: number;
  title: string;
  account: { companyName: string; contactName: string; email: string };
}): Promise<TransactionalEmailResult> {
  const portalUrl = new URL("/nl/zakelijk", BASE_URL).toString();
  return deliverTransactionalEmail({
    idempotencyKey: `business-order-list:${input.orderListId}:sent:${input.version}`,
    kind: EmailDeliveryKind.BUSINESS_ORDER_LIST,
    recipientEmail: input.account.email,
    recipientName: input.account.contactName,
    subject: `Nieuwe bestellijst van De Notenman: ${input.title}`,
    html: `<p>Beste ${escapeHtml(input.account.contactName)},</p><p>De bestellijst <strong>${escapeHtml(input.title)}</strong> staat klaar voor ${escapeHtml(input.account.companyName)}.</p><p><a href="${escapeHtml(portalUrl)}">Bekijk en keur de bestellijst goed</a></p><p>Je kunt aantallen aanpassen en een notitie voor Fedor achterlaten.</p>`,
    text: `Beste ${input.account.contactName},\n\nDe bestellijst ${input.title} staat klaar voor ${input.account.companyName}.\n\nBekijk de lijst: ${portalUrl}\n\nJe kunt aantallen aanpassen en een notitie voor Fedor achterlaten.`,
  });
}
