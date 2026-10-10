-- Circle detection is confident on roughly a third of the catalogue, so on its
-- own it can never give every product card a pre-rendered variant. The pipeline
-- now always produces one and records how it was framed and how good that
-- framing is, so coverage and quality can be asserted instead of assumed.
-- Expand-only: both columns are nullable and older rows keep meaning what they
-- always meant (a succeeded row without a strategy was a circle crop).
ALTER TABLE "ProductImageProcessing" ADD COLUMN "cropStrategy" TEXT;
ALTER TABLE "ProductImageProcessing" ADD COLUMN "qualityGrade" TEXT;

CREATE INDEX "ProductImageProcessing_processingVersion_qualityGrade_idx"
  ON "ProductImageProcessing" ("processingVersion", "qualityGrade");
