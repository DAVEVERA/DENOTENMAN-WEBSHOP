import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/admin-api-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { recordAudit } from "@/lib/admin-audit";
import { can } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { priceCartLines, validateContact, CheckoutError } from "@/lib/orders";
import { resolveTranslation } from "@/lib/queries";
import { getPickupLocation } from "@/lib/pickup-locations";

const line = z.object({ variantId: z.string().cuid(), quantity: z.number().int().min(1).max(100) }).strict();
const contact = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional(),
  deliveryMethod: z.enum(["SHIPPING", "PICKUP"]),
  pickupLocationId: z.string().trim().optional(),
  street: z.string().trim().max(160).optional(),
  houseNumber: z.string().trim().max(40).optional(),
  postalCode: z.string().trim().max(30).optional(),
  city: z.string().trim().max(100).optional(),
  country: z.enum(["NL", "BE"]),
}).strict();
const input = z.object({
  kind: z.enum(["MANUAL", "REPLACEMENT"]),
  requestKey: z.string().uuid(),
  originalOrderId: z.string().cuid().optional(),
  contact: contact.optional(),
  items: z.array(line).min(1).max(30),
  note: z.string().trim().max(2000).default(""),
}).strict().superRefine((value, context) => {
  if (new Set(value.items.map((item) => item.variantId)).size !== value.items.length) context.addIssue({ code: "custom", message: "Een variant mag maar één keer voorkomen.", path: ["items"] });
  if (value.kind === "MANUAL" && !value.contact) context.addIssue({ code: "custom", message: "Klantgegevens ontbreken.", path: ["contact"] });
  if (value.kind === "REPLACEMENT" && !value.originalOrderId) context.addIssue({ code: "custom", message: "De oorspronkelijke bestelling ontbreekt.", path: ["originalOrderId"] });
  if (value.kind === "REPLACEMENT" && !value.note) context.addIssue({ code: "custom", message: "Geef de reden voor de nabestelling op.", path: ["note"] });
});

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!can(admin.role, "orders", "write")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;
  const earlier = await prisma.order.findUnique({ where: { adminCreationKey: data.requestKey }, select: { id: true } });
  if (earlier) return NextResponse.json({ id: earlier.id });

  try {
    const original = data.kind === "REPLACEMENT"
      ? await prisma.order.findUnique({ where: { id: data.originalOrderId! } })
      : null;
    if (data.kind === "REPLACEMENT" && (!original || !["PENDING", "PAID", "FULFILLED"].includes(original.status) || original.origin === "REPLACEMENT")) {
      return NextResponse.json({ error: "INVALID_ORIGINAL_ORDER" }, { status: 409 });
    }
    const person = original ? {
      name: original.contactName, email: original.contactEmail, phone: original.contactPhone ?? undefined,
      deliveryMethod: original.deliveryMethod, pickupLocationId: original.pickupLocationId ?? undefined,
      street: original.shippingStreet ?? undefined, houseNumber: original.shippingHouseNumber ?? undefined,
      postalCode: original.shippingPostalCode ?? undefined, city: original.shippingCity ?? undefined,
      country: original.shippingCountry,
    } : data.contact!;
    validateContact(person);
    if (person.deliveryMethod === "PICKUP" && !getPickupLocation(person.pickupLocationId ?? "")) {
      return NextResponse.json({ error: "INVALID_PICKUP_LOCATION" }, { status: 400 });
    }

    const replacementLines = data.kind === "REPLACEMENT"
      ? await prisma.productVariant.findMany({
          where: { id: { in: data.items.map((item) => item.variantId) }, isActive: true, product: { isActive: true } },
          include: { translations: true, product: { include: { translations: true } } },
        })
      : [];
    if (data.kind === "REPLACEMENT" && replacementLines.length !== data.items.length) {
      return NextResponse.json({ error: "VARIANT_NOT_AVAILABLE" }, { status: 409 });
    }
    const priced = data.kind === "MANUAL"
      ? await priceCartLines(data.items, "nl", undefined, false, person.deliveryMethod, person.country as "NL" | "BE", { email: person.email })
      : null;
    const lines = data.kind === "REPLACEMENT"
      ? data.items.map((item) => {
          const variant = replacementLines.find((candidate) => candidate.id === item.variantId)!;
          return {
            variantId: variant.id,
            sku: variant.sku,
            productName: resolveTranslation(variant.product.translations, "nl")?.name ?? variant.product.slug,
            variantLabel: resolveTranslation(variant.translations, "nl")?.label ?? variant.sku,
            quantity: item.quantity,
            unitPriceCents: 0,
          };
        })
      : priced!.lines.map((item) => ({
          variantId: item.variantId,
          productName: item.productName,
          variantLabel: item.variantLabel,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          regularUnitPriceCents: item.regularUnitPriceCents,
          promotionLabel: item.promotionLabel,
        }));

    const created = await prisma.$transaction(async (tx) => {
      const user = original ? null : await tx.user.upsert({
        where: { email: person.email.toLowerCase() },
        update: {},
        create: { email: person.email.toLowerCase(), name: person.name },
      });
      const order = await tx.order.create({
        data: {
          adminCreationKey: data.requestKey,
          origin: data.kind,
          originalOrderId: original?.id ?? null,
          adminNote: data.note || null,
          userId: original?.userId ?? user!.id,
          status: data.kind === "REPLACEMENT" ? "PAID" : "PENDING",
          paidAt: data.kind === "REPLACEMENT" ? new Date() : null,
          locale: original?.locale ?? "nl",
          subtotalCents: priced?.subtotalCents ?? 0,
          shippingCents: priced?.shippingCents ?? 0,
          totalCents: priced?.totalCents ?? 0,
          contactName: person.name,
          contactEmail: person.email.toLowerCase(),
          contactPhone: person.phone || null,
          deliveryMethod: person.deliveryMethod,
          pickupLocationId: person.deliveryMethod === "PICKUP" ? person.pickupLocationId : null,
          shippingStreet: person.deliveryMethod === "SHIPPING" ? person.street : null,
          shippingHouseNumber: person.deliveryMethod === "SHIPPING" ? person.houseNumber : null,
          shippingPostalCode: person.deliveryMethod === "SHIPPING" ? person.postalCode : null,
          shippingCity: person.deliveryMethod === "SHIPPING" ? person.city : null,
          shippingCountry: person.country,
          items: { create: lines },
        },
      });
      await recordAudit(tx, admin, "Order", order.id, "CREATE", undefined, { origin: data.kind, originalOrderId: original?.id ?? null, itemCount: lines.length, totalCents: order.totalCents });
      return order;
    });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    if (error instanceof CheckoutError) return NextResponse.json({ error: error.code, message: error.message }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.order.findUnique({ where: { adminCreationKey: data.requestKey }, select: { id: true } });
      if (existing) return NextResponse.json({ id: existing.id });
    }
    console.error("Admin order creation failed", { kind: data.kind, error });
    return NextResponse.json({ error: "CREATE_FAILED" }, { status: 500 });
  }
}
