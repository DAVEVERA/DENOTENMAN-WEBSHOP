import { createPostnlLabelJob } from "../jobs/create-postnl-label";

export const shipmentQueue = {
  name: "shipment",
  jobs: [createPostnlLabelJob],
};
