import { centsToMollieValue, createMollieClient, type MollieClientConfig } from "./client";

export type CreateMollieRefundInput = {
  paymentId: string;
  amountCents: number;
  description?: string;
};

export async function createMollieRefund(
  config: MollieClientConfig,
  input: CreateMollieRefundInput,
) {
  const client = createMollieClient(config);

  return client.post(`/payments/${encodeURIComponent(input.paymentId)}/refunds`, {
    amount: {
      currency: "EUR",
      value: centsToMollieValue(input.amountCents),
    },
    description: input.description,
  });
}
