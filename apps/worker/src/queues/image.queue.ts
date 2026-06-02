import { processProductImageJob } from "../jobs/process-product-image";

export const imageQueue = {
  name: "image",
  jobs: [processProductImageJob],
};
