import { createWorkerResult, type WorkerJob } from "../index";

export const dailyBackupCron: WorkerJob<{ dryRun?: boolean }> = {
  name: "daily-backup",
  async run(payload) {
    return createWorkerResult(this.name, payload.dryRun ? "Backup dry-run voorbereid." : "Backup job voorbereid.");
  },
};
