import { prisma } from "@/lib/prisma";
import { createShipmentLabel, determineLabelAction } from "@/lib/postnl";

export class PostnlLabelGuardError extends Error {
  constructor(
    public code: "ORDER_NOT_FOUND" | "ORDER_NOT_SHIPPABLE",
    message: string
  ) {
    super(message);
    this.name = "PostnlLabelGuardError";
  }
}

export type EnsuredPostnlLabel = {
  barcode: string | null;
  labelBase64: string;
  reused: boolean;
};

export async function ensurePostnlLabel(orderId: string): Promise<EnsuredPostnlLabel> {
  return prisma.$transaction(
    async (transaction) => {
      const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Order"
        WHERE "id" = ${orderId}
        FOR UPDATE
      `;

      if (lockedRows.length === 0) {
        throw new PostnlLabelGuardError("ORDER_NOT_FOUND", "Bestelling niet gevonden.");
      }

      const order = await transaction.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: {
            select: {
              quantity: true,
              variant: { select: { weightGrams: true } },
            },
          },
        },
      });

      const action = determineLabelAction(order.status, Boolean(order.postnlLabelBase64));
      if (action === "reject") {
        throw new PostnlLabelGuardError(
          "ORDER_NOT_SHIPPABLE",
          "Alleen betaalde of verzonden bestellingen kunnen een PostNL-label krijgen."
        );
      }
      if (action === "reuse" && order.postnlLabelBase64) {
        return {
          barcode: order.postnlTrackingCode,
          labelBase64: order.postnlLabelBase64,
          reused: true,
        };
      }

      const { barcode, labelBase64 } = await createShipmentLabel(order);
      await transaction.order.update({
        where: { id: order.id },
        data: { postnlTrackingCode: barcode, postnlLabelBase64: labelBase64 },
      });

      return { barcode, labelBase64, reused: false };
    },
    { maxWait: 10_000, timeout: 60_000 }
  );
}
