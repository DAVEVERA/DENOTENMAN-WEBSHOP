import {
  centsToMollieValue,
  createMollieClient,
  type MollieClientConfig,
  type MolliePayment,
} from "./client";

export type CreateMolliePaymentInput = {
  amountCents: number;
  description: string;
  redirectUrl: string;
  webhookUrl?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function createMolliePayment(
  config: MollieClientConfig,
  input: CreateMolliePaymentInput,
) {
  const client = createMollieClient(config);

  return client.post<MolliePayment>("/payments", {
    amount: {
      currency: "EUR",
      value: centsToMollieValue(input.amountCents),
    },
    description: input.description,
    redirectUrl: input.redirectUrl,
    webhookUrl: input.webhookUrl,
    metadata: input.metadata,
  });
}
