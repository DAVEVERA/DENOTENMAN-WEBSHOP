-- The logo object itself is immutable in GCS. Only this nullable pointer is
-- replaced, which keeps the migration backward-compatible for all accounts.
ALTER TABLE "BusinessAccount" ADD COLUMN "logoStorageKey" TEXT;

CREATE UNIQUE INDEX "BusinessAccount_logoStorageKey_key"
ON "BusinessAccount"("logoStorageKey");
