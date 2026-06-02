import { createWorkerResult, type WorkerJob } from "../index";

export type CreatePostnlLabelPayload = {
  orderId: string;
  shipmentId: string;
};

export const createPostnlLabelJob: WorkerJob<CreatePostnlLabelPayload> = {
  name: "create-postnl-label",
  async run(payload) {
    if (!payload.orderId || !payload.shipmentId) throw new Error("Order en shipment zijn verplicht.");
    return createWorkerResult(this.name, `PostNL label-aanvraag voorbereid voor order ${payload.orderId}.`);
  },
};
