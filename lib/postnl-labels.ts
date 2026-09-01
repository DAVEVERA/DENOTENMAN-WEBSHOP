import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  createShipmentBarcode,
  createShipmentLabel,
  determineLabelAction,
} from "@/lib/postnl";

const CLAIM_STALE_AFTER_MS = 2 * 60 * 1_000;

export class PostnlLabelGuardError extends Error {
  constructor(
    public code: "ORDER_NOT_FOUND" | "ORDER_NOT_SHIPPABLE" | "LABEL_IN_PROGRESS",
    message: string
  ) {
    super(message);
    this.name = "PostnlLabelGuardError";
  }
}

function assertShippableAddress(
  order: {
    deliveryMethod: string;
    shippingStreet: string | null;
    shippingHouseNumber: string | null;
    shippingPostalCode: string | null;
    shippingCity: string | null;
  }
): asserts order is typeof order & {
  shippingStreet: string;
  shippingHouseNumber: string;
  shippingPostalCode: string;
  shippingCity: string;
} {
  if (
    order.deliveryMethod !== "SHIPPING" ||
    !order.shippingStreet ||
    !order.shippingHouseNumber ||
    !order.shippingPostalCode ||
    !order.shippingCity
  ) {
    throw new PostnlLabelGuardError(
      "ORDER_NOT_SHIPPABLE",
      "Deze bestelling wordt afgehaald en heeft geen verzendadres."
    );
  }
}

/**
 * A free-form (non-catalog) order line, such as one Fedor added manually to a
 * business bestellijst, has no ProductVariant and therefore no known weight.
 * PostNL labels can only be generated automatically when every line can be
 * weighed.
 */
function assertWeighableItems<T extends { variant: { weightGrams: number } | null }>(
  items: T[]
): asserts items is (T & { variant: { weightGrams: number } })[] {
  if (items.some((item) => item.variant === null)) {
    throw new PostnlLabelGuardError(
      "ORDER_NOT_SHIPPABLE",
      "Deze bestelling bevat een regel zonder productvariant en kan niet automatisch worden gewogen voor PostNL."
    );
  }
}

export type EnsuredPostnlLabel = {
  barcode: string | null;
  labelBase64: string;
  reused: boolean;
};

const orderWithItems = {
  items: {
    select: {
      quantity: true,
      variant: { select: { weightGrams: true } },
    },
  },
} as const;

function toLastError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Onbekende fout bij PostNL.";
  return message.slice(0, 2_000);
}

/**
 * Claims label creation with one atomic UPDATE, then performs all PostNL calls
 * outside a database transaction. A generated barcode is persisted before the
 * label request, so a retry uses the same barcode instead of creating another
 * shipment identity.
 */
export async function ensurePostnlLabel(orderId: string): Promise<EnsuredPostnlLabel> {
  const initialOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderWithItems,
  });

  if (!initialOrder) {
    throw new PostnlLabelGuardError("ORDER_NOT_FOUND", "Bestelling niet gevonden.");
  }

  const action = determineLabelAction(
    initialOrder.status,
    Boolean(initialOrder.postnlLabelBase64),
    initialOrder.isTest
  );
  if (action === "reject") {
    throw new PostnlLabelGuardError(
      "ORDER_NOT_SHIPPABLE",
      initialOrder.isTest
        ? "Testbestellingen krijgen nooit een PostNL-label."
        : "Alleen betaalde of verzonden bestellingen kunnen een PostNL-label krijgen."
    );
  }
  if (action === "reuse" && initialOrder.postnlLabelBase64) {
    return {
      barcode: initialOrder.postnlTrackingCode,
      labelBase64: initialOrder.postnlLabelBase64,
      reused: true,
    };
  }

  assertShippableAddress(initialOrder);
  assertWeighableItems(initialOrder.items);

  const claimToken = randomUUID();
  const claimedAt = new Date();
  const staleBefore = new Date(claimedAt.getTime() - CLAIM_STALE_AFTER_MS);
  const claim = await prisma.order.updateMany({
    where: {
      id: orderId,
      isTest: false,
      status: { in: ["PAID", "FULFILLED"] },
      postnlLabelBase64: null,
      OR: [
        { postnlLabelClaimToken: null },
        { postnlLabelClaimedAt: { lte: staleBefore } },
      ],
    },
    data: {
      postnlLabelClaimToken: claimToken,
      postnlLabelClaimedAt: claimedAt,
      postnlLabelLastError: null,
    },
  });

  if (claim.count !== 1) {
    const current = await prisma.order.findUnique({
      where: { id: orderId },
      select: { postnlTrackingCode: true, postnlLabelBase64: true },
    });
    if (current?.postnlLabelBase64) {
      return {
        barcode: current.postnlTrackingCode,
        labelBase64: current.postnlLabelBase64,
        reused: true,
      };
    }
    throw new PostnlLabelGuardError(
      "LABEL_IN_PROGRESS",
      "Voor deze bestelling wordt al een PostNL-label aangemaakt. Probeer het over enkele ogenblikken opnieuw."
    );
  }

  try {
    let barcode = initialOrder.postnlTrackingCode;
    if (!barcode) {
      barcode = await createShipmentBarcode();
      const barcodeStored = await prisma.order.updateMany({
        where: {
          id: orderId,
          postnlLabelClaimToken: claimToken,
          postnlLabelBase64: null,
        },
        data: { postnlTrackingCode: barcode },
      });
      if (barcodeStored.count !== 1) {
        throw new PostnlLabelGuardError(
          "LABEL_IN_PROGRESS",
          "De PostNL-labelaanvraag is door een nieuwere aanvraag overgenomen."
        );
      }
    }

    const { labelBase64 } = await createShipmentLabel({ ...initialOrder, items: initialOrder.items }, barcode);
    const labelStored = await prisma.order.updateMany({
      where: {
        id: orderId,
        postnlLabelClaimToken: claimToken,
        postnlLabelBase64: null,
      },
      data: {
        postnlTrackingCode: barcode,
        postnlLabelBase64: labelBase64,
        postnlLabelClaimToken: null,
        postnlLabelClaimedAt: null,
        postnlLabelLastError: null,
      },
    });

    if (labelStored.count !== 1) {
      const current = await prisma.order.findUnique({
        where: { id: orderId },
        select: { postnlTrackingCode: true, postnlLabelBase64: true },
      });
      if (current?.postnlLabelBase64) {
        return {
          barcode: current.postnlTrackingCode,
          labelBase64: current.postnlLabelBase64,
          reused: true,
        };
      }
      throw new PostnlLabelGuardError(
        "LABEL_IN_PROGRESS",
        "De PostNL-labelaanvraag is door een nieuwere aanvraag overgenomen."
      );
    }

    return { barcode, labelBase64, reused: false };
  } catch (error) {
    await prisma.order.updateMany({
      where: { id: orderId, postnlLabelClaimToken: claimToken },
      data: {
        postnlLabelClaimToken: null,
        postnlLabelClaimedAt: null,
        postnlLabelLastError: toLastError(error),
      },
    });
    throw error;
  }
}
