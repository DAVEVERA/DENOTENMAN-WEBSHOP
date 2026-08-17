export const committedRefundStatuses = [
  "CREATING",
  "QUEUED",
  "PENDING",
  "PROCESSING",
  "REFUNDED",
] as const;

export type CommittedRefundStatus = (typeof committedRefundStatuses)[number];

export type RefundableOrderItem = {
  id: string;
  quantity: number;
  unitPriceCents: number;
};

export type RefundItemSelection = {
  orderItemId: string;
  quantity: number;
};

export type ExistingRefundReservation = {
  status: string;
  amountCents: number;
  includesShipping: boolean;
  items: Array<{
    orderItemId: string;
    quantity: number;
    grossAmountCents: number;
  }>;
};

export class OrderRefundCalculationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "OrderRefundCalculationError";
  }
}

export function isCommittedRefundStatus(status: string): status is CommittedRefundStatus {
  return (committedRefundStatuses as readonly string[]).includes(status);
}

export function calculateOrderRefund(input: {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  items: RefundableOrderItem[];
  selections: RefundItemSelection[];
  existingRefunds: ExistingRefundReservation[];
  includeShipping: boolean;
}) {
  const committed = input.existingRefunds.filter((refund) =>
    isCommittedRefundStatus(refund.status)
  );
  const itemById = new Map(input.items.map((item) => [item.id, item]));
  const alreadyCanceledByItem = new Map<string, number>();

  for (const refund of committed) {
    for (const item of refund.items) {
      alreadyCanceledByItem.set(
        item.orderItemId,
        (alreadyCanceledByItem.get(item.orderItemId) ?? 0) + item.quantity
      );
    }
  }

  const seen = new Set<string>();
  const selectedItems = input.selections.map((selection) => {
    if (seen.has(selection.orderItemId)) {
      throw new OrderRefundCalculationError("DUPLICATE_ORDER_ITEM");
    }
    seen.add(selection.orderItemId);

    const item = itemById.get(selection.orderItemId);
    if (!item) throw new OrderRefundCalculationError("ORDER_ITEM_NOT_FOUND");
    if (!Number.isSafeInteger(selection.quantity) || selection.quantity < 1) {
      throw new OrderRefundCalculationError("INVALID_REFUND_QUANTITY");
    }
    const available = item.quantity - (alreadyCanceledByItem.get(item.id) ?? 0);
    if (selection.quantity > available) {
      throw new OrderRefundCalculationError("REFUND_QUANTITY_EXCEEDS_REMAINING");
    }

    return {
      orderItemId: item.id,
      quantity: selection.quantity,
      grossAmountCents: item.unitPriceCents * selection.quantity,
    };
  });

  if (selectedItems.length === 0) {
    throw new OrderRefundCalculationError("NO_REFUND_ITEMS");
  }
  if (input.includeShipping && committed.some((refund) => refund.includesShipping)) {
    throw new OrderRefundCalculationError("SHIPPING_ALREADY_REFUNDED");
  }

  const existingGrossCents = committed.reduce(
    (total, refund) =>
      total + refund.items.reduce((sum, item) => sum + item.grossAmountCents, 0),
    0
  );
  const selectedGrossCents = selectedItems.reduce(
    (total, item) => total + item.grossAmountCents,
    0
  );
  const allocatedDiscountBefore =
    input.subtotalCents > 0
      ? Math.round(
          (input.discountCents * Math.min(existingGrossCents, input.subtotalCents)) /
            input.subtotalCents
        )
      : 0;
  const allocatedDiscountAfter =
    input.subtotalCents > 0
      ? Math.round(
          (input.discountCents *
            Math.min(existingGrossCents + selectedGrossCents, input.subtotalCents)) /
            input.subtotalCents
        )
      : 0;
  const allocatedDiscountCents = allocatedDiscountAfter - allocatedDiscountBefore;
  const amountCents =
    selectedGrossCents -
    allocatedDiscountCents +
    (input.includeShipping ? input.shippingCents : 0);
  const alreadyReservedCents = committed.reduce(
    (total, refund) => total + refund.amountCents,
    0
  );
  const remainingOrderCents = Math.max(0, input.totalCents - alreadyReservedCents);

  if (amountCents < 1) {
    throw new OrderRefundCalculationError("REFUND_AMOUNT_ZERO");
  }
  if (amountCents > remainingOrderCents) {
    throw new OrderRefundCalculationError("REFUND_AMOUNT_EXCEEDS_REMAINING");
  }

  return {
    amountCents,
    selectedGrossCents,
    allocatedDiscountCents,
    remainingOrderCents,
    items: selectedItems,
  };
}
