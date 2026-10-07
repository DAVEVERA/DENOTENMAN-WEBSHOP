-- Choice per invoice: set it ready without e-mailing the client. Existing invoices keep notifying.
ALTER TABLE "DeveloperInvoice" ADD COLUMN "notifyClient" BOOLEAN NOT NULL DEFAULT true;
