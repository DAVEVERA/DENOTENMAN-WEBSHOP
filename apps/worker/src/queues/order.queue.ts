import { generateInvoiceJob } from "../jobs/generate-invoice";
import { syncPaymentStatusJob } from "../jobs/sync-payment-status";

export const orderQueue = {
  name: "order",
  jobs: [syncPaymentStatusJob, generateInvoiceJob],
};
