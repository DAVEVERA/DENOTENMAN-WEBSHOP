-- Additive rich-text storage for the short product description. The existing
-- plain column remains available for rollback and text-only consumers.
ALTER TABLE "ProductTranslation"
  ADD COLUMN "shortDescriptionHtml" TEXT;
