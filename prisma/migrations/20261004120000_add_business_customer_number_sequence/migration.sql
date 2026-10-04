-- Customer numbers are database-owned so concurrent account creation cannot
-- hand out the same number. The table lock keeps the deterministic backfill
-- and installation of the default in one atomic migration boundary.
BEGIN;

LOCK TABLE "BusinessAccount" IN ACCESS EXCLUSIVE MODE;

CREATE SEQUENCE IF NOT EXISTS "BusinessAccount_customerNumber_seq"
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1
  OWNED BY "BusinessAccount"."customerNumber";

-- Preserve every existing customer number. Only NULL rows are numbered, in a
-- stable createdAt/id order, after the highest existing ZK number. Re-running
-- this block is safe because an already numbered row no longer matches.
WITH existing_max AS (
  SELECT COALESCE(
    MAX(SUBSTRING("customerNumber" FROM 4)::BIGINT)
      FILTER (WHERE "customerNumber" ~ '^ZK-[0-9]+$'),
    0
  ) AS value
  FROM "BusinessAccount"
), missing AS MATERIALIZED (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS offset
  FROM "BusinessAccount"
  WHERE "customerNumber" IS NULL
), assigned AS (
  SELECT
    missing."id",
    existing_max.value + missing.offset AS number
  FROM missing
  CROSS JOIN existing_max
)
UPDATE "BusinessAccount" AS account
SET "customerNumber" = 'ZK-' || LPAD(assigned.number::TEXT, 5, '0')
FROM assigned
WHERE account."id" = assigned."id"
  AND account."customerNumber" IS NULL;

-- Align the sequence after both preserved and newly backfilled ZK numbers.
SELECT setval(
  '"BusinessAccount_customerNumber_seq"'::regclass,
  GREATEST(
    COALESCE((
      SELECT MAX(SUBSTRING("customerNumber" FROM 4)::BIGINT)
      FROM "BusinessAccount"
      WHERE "customerNumber" ~ '^ZK-[0-9]+$'
    ), 0),
    1
  ),
  COALESCE((
    SELECT MAX(SUBSTRING("customerNumber" FROM 4)::BIGINT)
    FROM "BusinessAccount"
    WHERE "customerNumber" ~ '^ZK-[0-9]+$'
  ), 0) > 0
);

ALTER TABLE "BusinessAccount"
  ALTER COLUMN "customerNumber" SET DEFAULT (
    'ZK-' || LPAD(nextval('"BusinessAccount_customerNumber_seq"'::regclass)::TEXT, 5, '0')
  ),
  ALTER COLUMN "customerNumber" SET NOT NULL;

COMMIT;
