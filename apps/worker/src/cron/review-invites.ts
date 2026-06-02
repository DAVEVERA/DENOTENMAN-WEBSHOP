import { createWorkerResult, type WorkerJob } from "../index";

export const reviewInvitesCron: WorkerJob<{ daysAfterShipment?: number }> = {
  name: "review-invites",
  async run(payload) {
    return createWorkerResult(
      this.name,
      `Review-uitnodigingen voorbereid na ${payload.daysAfterShipment ?? 10} dagen.`,
    );
  },
};
