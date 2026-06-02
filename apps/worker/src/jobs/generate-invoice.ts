import { createWorkerResult, type WorkerJob } from "../index";

export type GenerateInvoicePayload = {
  orderId: string;
  invoiceNumber: string;
};

export const generateInvoiceJob: WorkerJob<GenerateInvoicePayload> = {
  name: "generate-invoice",
  async run(payload) {
    if (!payload.orderId || !payload.invoiceNumber) throw new Error("Order en factuurnummer zijn verplicht.");
    return createWorkerResult(this.name, `Factuurgeneratie voorbereid voor ${payload.invoiceNumber}.`);
  },
};
