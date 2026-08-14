-- AlterTable
ALTER TABLE "ProductTranslation" ADD COLUMN "shortDescription" TEXT;

-- Backfill a card-safe excerpt from existing copy without adding new claims.
WITH normalized AS (
  SELECT
    "id",
    btrim(regexp_replace("description", '[[:space:]]+', ' ', 'g')) AS "value"
  FROM "ProductTranslation"
  WHERE "description" IS NOT NULL
),
bounded AS (
  SELECT
    "id",
    CASE
      WHEN char_length("value") <= 160 THEN "value"
      WHEN strpos(left("value", 157), ' ') = 0 THEN NULL
      ELSE regexp_replace(left("value", 157), '[[:space:]][^[:space:]]*$', '') || '...'
    END AS "value"
  FROM normalized
  WHERE "value" <> ''
)
UPDATE "ProductTranslation" AS translation
SET "shortDescription" = bounded."value"
FROM bounded
WHERE translation."id" = bounded."id"
  AND bounded."value" IS NOT NULL;
