type OrderReference = {
  id: string;
  orderNumber?: string | null;
};

export function publicOrderNumber(order: OrderReference): string {
  return order.orderNumber ?? order.id;
}

export function buildMollieOrderReference(order: OrderReference) {
  const orderNumber = publicOrderNumber(order);
  return {
    description: `Bestelling ${orderNumber} - De Notenman`,
    metadata: {
      orderId: order.id,
      orderNumber,
    },
  };
}

export function orderLookupWhere(reference: string) {
  const normalizedReference = reference.trim();
  return {
    OR: [{ orderNumber: normalizedReference }, { id: normalizedReference }],
  };
}
