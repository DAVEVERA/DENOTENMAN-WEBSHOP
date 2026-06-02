import { createWorkerResult, type WorkerJob } from "../index";

export type SendOrderConfirmationPayload = {
  orderId: string;
  email: string;
};

export const sendOrderConfirmationJob: WorkerJob<SendOrderConfirmationPayload> = {
  name: "send-order-confirmation",
  async run(payload) {
    if (!payload.orderId || !payload.email) throw new Error("Order-id en e-mail zijn verplicht.");
    return createWorkerResult(this.name, `Orderbevestiging voorbereid voor ${payload.email}.`);
  },
};
