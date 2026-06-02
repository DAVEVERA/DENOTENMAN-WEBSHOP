import type { MollieClientConfig, MolliePayment } from "./client";
import { getMolliePayment } from "./get-payment";
import {
  mapMolliePaymentStatus,
  mapPaymentStatusToOrderStatus,
} from "./payment-status-map";

export type MollieWebhookResult = {
  providerPaymentId: string;
  paymentStatus: ReturnType<typeof mapMolliePaymentStatus>;
  orderStatus: ReturnType<typeof mapPaymentStatusToOrderStatus>;
  payment: MolliePayment;
};

export async function handleMollieWebhook(
  config: MollieClientConfig,
  providerPaymentId: string,
): Promise<MollieWebhookResult> {
  const payment = await getMolliePayment(config, providerPaymentId);
  const paymentStatus = mapMolliePaymentStatus(payment.status);

  return {
    providerPaymentId,
    paymentStatus,
    orderStatus: mapPaymentStatusToOrderStatus(paymentStatus),
    payment,
  };
}
