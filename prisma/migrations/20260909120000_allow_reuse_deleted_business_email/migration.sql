-- Keep historical soft-deleted business accounts, while allowing their email
-- address to be used by one new active account.
DROP INDEX "BusinessAccount_email_key";

CREATE UNIQUE INDEX "BusinessAccount_active_email_key"
ON "BusinessAccount" (LOWER("email"))
WHERE "deletedAt" IS NULL;
