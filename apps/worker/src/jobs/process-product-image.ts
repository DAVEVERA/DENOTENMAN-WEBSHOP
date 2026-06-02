import { createWorkerResult, type WorkerJob } from "../index";

export type ProcessProductImagePayload = {
  bucket: string;
  path: string;
  productId?: number;
};

export const processProductImageJob: WorkerJob<ProcessProductImagePayload> = {
  name: "process-product-image",
  async run(payload) {
    if (!payload.bucket || !payload.path) throw new Error("Bucket en pad zijn verplicht.");
    return createWorkerResult(this.name, `Image processing ingepland voor ${payload.bucket}/${payload.path}.`);
  },
};
