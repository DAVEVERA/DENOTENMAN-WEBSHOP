import { createWorkerResult, type WorkerJob } from "../index";

export const lowStockAlertsCron: WorkerJob<{ threshold?: number }> = {
  name: "low-stock-alerts",
  async run(payload) {
    return createWorkerResult(this.name, `Low-stock controle voorbereid met drempel ${payload.threshold ?? 5}.`);
  },
};
