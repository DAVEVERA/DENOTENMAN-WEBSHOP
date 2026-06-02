import { createWorkerResult, type WorkerJob } from "../index";

export type CleanupAbandonedCartsPayload = {
  olderThanHours: number;
  dryRun?: boolean;
};

export const cleanupAbandonedCartsJob: WorkerJob<CleanupAbandonedCartsPayload> = {
  name: "cleanup-abandoned-carts",
  async run(payload) {
    if (payload.olderThanHours < 1) throw new Error("olderThanHours moet minimaal 1 zijn.");
    return createWorkerResult(
      this.name,
      `${payload.dryRun ? "Dry-run" : "Cleanup"} voorbereid voor carts ouder dan ${payload.olderThanHours} uur.`,
    );
  },
};
