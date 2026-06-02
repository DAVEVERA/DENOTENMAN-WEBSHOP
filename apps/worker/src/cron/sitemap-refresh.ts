import { createWorkerResult, type WorkerJob } from "../index";

export const sitemapRefreshCron: WorkerJob<{ siteUrl: string }> = {
  name: "sitemap-refresh",
  async run(payload) {
    if (!payload.siteUrl) throw new Error("Site URL ontbreekt.");
    return createWorkerResult(this.name, `Sitemap refresh voorbereid voor ${payload.siteUrl}.`);
  },
};
