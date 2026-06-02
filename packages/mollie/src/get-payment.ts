import { createMollieClient, type MollieClientConfig, type MolliePayment } from "./client";

export async function getMolliePayment(config: MollieClientConfig, paymentId: string) {
  if (!paymentId.trim()) {
    throw new Error("Mollie payment id ontbreekt.");
  }

  const client = createMollieClient(config);
  return client.get<MolliePayment>(`/payments/${encodeURIComponent(paymentId)}`);
}
