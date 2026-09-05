import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { recordBusinessEvent } from "@/lib/business-portal";
import { resolveVat } from "@/lib/business-vat";
import {
  BUSINESS_LOGO_MAX_FILE_BYTES,
  BusinessLogoValidationError,
  buildBusinessLogoStorageKey,
  businessLogoUploadLengthError,
  normalizeBusinessLogo,
} from "@/lib/business-logo";
import {
  deleteProductAsset,
  publicStorageUrl,
  saveImmutableProductAsset,
} from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const optionalShortText = z.string().trim().max(255).nullable().optional();
const optionalAddressText = z.string().trim().max(191).nullable().optional();

const businessAccountInputSchema = z
  .object({
    companyName: z.string().trim().min(1, "companyName required").max(191),
    contactName: z.string().trim().min(1, "contactName required").max(191),
    email: z.string().trim().email("valid email required").max(320),
    phone: optionalShortText,
    vatNumber: optionalShortText,
    kvkNumber: optionalShortText,
    country: z.enum(["NL", "BE"]).optional(),
    vatRegime: z.enum(["STANDARD", "REVERSE_CHARGE"]).optional(),
    vatRatePercent: z.coerce.number().min(0).max(100).optional(),
    peppolConfigured: z.boolean().optional(),
    peppolParticipantId: optionalShortText,
    fixedPickupLocationId: z.enum(["hilvarenbeek", "uden", "antwerpen", "haaren"]).nullable().optional(),
    pickupFrequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "ON_REQUEST"]).nullable().optional(),
    shippingEnabled: z.boolean().optional(),
    billingStreet: optionalAddressText,
    billingHouseNumber: optionalAddressText,
    billingPostalCode: optionalAddressText,
    billingCity: optionalAddressText,
    billingCountry: z.enum(["NL", "BE"]).nullable().optional(),
    shippingStreet: optionalAddressText,
    shippingHouseNumber: optionalAddressText,
    shippingPostalCode: optionalAddressText,
    shippingCity: optionalAddressText,
    shippingCountry: z.enum(["NL", "BE"]).nullable().optional(),
    businessNewsletterOptIn: z.boolean().optional(),
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]).optional(),
    notes: z.string().trim().max(4_000).nullable().optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const businessAccounts = await prisma.businessAccount.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ businessAccounts });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (admin.role === "STAFF") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });

  const contentType = request.headers.get("content-type") ?? "";
  let rawInput: unknown;
  let logo: File | null = null;

  if (contentType.toLowerCase().startsWith("multipart/form-data")) {
    const lengthError = businessLogoUploadLengthError(request.headers.get("content-length"));
    if (lengthError) return NextResponse.json({ error: lengthError }, { status: 413 });

    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "INVALID_MULTIPART_BODY" }, { status: 400 });
    const payload = form.get("payload");
    if (typeof payload !== "string") {
      return NextResponse.json({ error: "PAYLOAD_REQUIRED" }, { status: 400 });
    }
    try {
      rawInput = JSON.parse(payload);
    } catch {
      return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
    }
    const uploadedLogo = form.get("logo");
    if (uploadedLogo instanceof File && uploadedLogo.size > 0) logo = uploadedLogo;
  } else {
    rawInput = await request.json().catch(() => null);
  }

  const parsed = businessAccountInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const country = input.country ?? "NL";
  const vatDefaults = resolveVat(country);
  const id = randomUUID();
  let normalizedLogo: Awaited<ReturnType<typeof normalizeBusinessLogo>> | null = null;
  let logoStorageKey: string | null = null;
  let logoStored = false;

  if (logo) {
    if (!Number.isSafeInteger(logo.size) || logo.size > BUSINESS_LOGO_MAX_FILE_BYTES) {
      return NextResponse.json({ error: "LOGO_TOO_LARGE" }, { status: 400 });
    }
    try {
      normalizedLogo = await normalizeBusinessLogo(Buffer.from(await logo.arrayBuffer()), logo.type);
      logoStorageKey = buildBusinessLogoStorageKey(id);
      publicStorageUrl(logoStorageKey);
    } catch (error) {
      if (error instanceof BusinessLogoValidationError) {
        return NextResponse.json({ error: error.code }, { status: 400 });
      }
      console.error("Business logo storage is unavailable", { error });
      return NextResponse.json({ error: "LOGO_STORAGE_UNAVAILABLE" }, { status: 503 });
    }
  }

  try {
    if (normalizedLogo && logoStorageKey) {
      await saveImmutableProductAsset(logoStorageKey, normalizedLogo.bytes, normalizedLogo.contentType);
      logoStored = true;
    }

    const created = await prisma.$transaction(async (tx) => {
      const businessAccount = await tx.businessAccount.create({
        data: {
          id,
          companyName: input.companyName,
          contactName: input.contactName,
          email: input.email.toLowerCase(),
          phone: input.phone?.trim() ? input.phone.trim() : null,
          vatNumber: input.vatNumber?.trim() ? input.vatNumber.trim() : null,
          kvkNumber: input.kvkNumber?.trim() ? input.kvkNumber.trim() : null,
          country,
          vatRegime: input.vatRegime ?? vatDefaults.regime,
          vatRatePercent: input.vatRatePercent ?? vatDefaults.ratePercent,
          peppolConfigured: input.peppolConfigured ?? Boolean(input.peppolParticipantId?.trim()),
          peppolParticipantId: input.peppolParticipantId?.trim() || null,
          fixedPickupLocationId: input.fixedPickupLocationId ?? null,
          pickupFrequency: input.pickupFrequency ?? null,
          shippingEnabled: input.shippingEnabled ?? false,
          billingStreet: input.billingStreet?.trim() || null,
          billingHouseNumber: input.billingHouseNumber?.trim() || null,
          billingPostalCode: input.billingPostalCode?.trim() || null,
          billingCity: input.billingCity?.trim() || null,
          billingCountry: input.billingCountry ?? null,
          shippingStreet: input.shippingStreet?.trim() || null,
          shippingHouseNumber: input.shippingHouseNumber?.trim() || null,
          shippingPostalCode: input.shippingPostalCode?.trim() || null,
          shippingCity: input.shippingCity?.trim() || null,
          shippingCountry: input.shippingCountry ?? null,
          businessNewsletterOptIn: input.businessNewsletterOptIn ?? false,
          businessNewsletterConsentAt: input.businessNewsletterOptIn ? new Date() : null,
          status: input.status ?? "PENDING",
          notes: input.notes?.trim() ? input.notes.trim() : null,
          logoStorageKey,
        },
      });

      await recordAudit(tx, admin, "BusinessAccount", businessAccount.id, "CREATE", null, businessAccount);
      await recordBusinessEvent(tx, {
        businessAccountId: businessAccount.id,
        type: "ACCOUNT_CREATED",
        actorType: "ADMIN",
        actorName: admin.name,
        summary: `Zakelijk account voor ${businessAccount.companyName} aangemaakt`,
      });

      return businessAccount;
    });

    return NextResponse.json({ ok: true, businessAccount: created }, { status: 201 });
  } catch (error) {
    if (logoStored && logoStorageKey) {
      await deleteProductAsset(logoStorageKey).catch((cleanupError) => {
        console.error("Could not clean up uncommitted business logo", { businessAccountId: id, cleanupError });
      });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "EMAIL_ALREADY_EXISTS" }, { status: 409 });
    }
    console.error("Business account creation failed", { error });
    return NextResponse.json({ error: logoStored ? "ACCOUNT_CREATE_FAILED" : "CREATE_FAILED" }, { status: 500 });
  }
}
