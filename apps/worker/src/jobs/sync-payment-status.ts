import { createWorkerResult, type WorkerJob } from "../index";

export type SyncPaymentStatusPayload = {
  paymentId: string;
  provider: "mollie" | "stripe";
};

export const syncPaymentStatusJob: WorkerJob<SyncPaymentStatusPayload> = {
  name: "sync-payment-status",
  async run(payload) {
    if (!payload.paymentId) throw new Error("Payment-id ontbreekt.");
    return createWorkerResult(this.name, `Paymentstatus sync voorbereid voor ${payload.provider}.`);
  },
};
