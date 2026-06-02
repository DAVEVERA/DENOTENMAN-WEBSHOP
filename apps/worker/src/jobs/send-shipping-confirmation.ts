import { createWorkerResult, type WorkerJob } from "../index";

export type SendShippingConfirmationPayload = {
  orderId: string;
  email: string;
  trackingCode: string;
};

export const sendShippingConfirmationJob: WorkerJob<SendShippingConfirmationPayload> = {
  name: "send-shipping-confirmation",
  async run(payload) {
    if (!payload.trackingCode) throw new Error("Trackingcode ontbreekt.");
    return createWorkerResult(this.name, `Verzendbevestiging voorbereid voor ${payload.email}.`);
  },
};
