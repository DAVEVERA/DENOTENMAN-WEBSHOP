-- Existing orders intentionally remain NULL. The default is installed only
-- after adding the column, so only orders inserted from this migration onward
-- receive a customer-facing number.
CREATE SEQUENCE "Order_orderNumber_seq"
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- Continue after the number of existing orders without assigning a public
-- number to those historical rows. With 124 existing orders, for example,
-- the first future order becomes DN-<year>-00125.
SELECT setval(
  '"Order_orderNumber_seq"'::regclass,
  GREATEST((SELECT COUNT(*) FROM "Order"), 1),
  (SELECT COUNT(*) > 0 FROM "Order")
);

ALTER TABLE "Order"
  ADD COLUMN "orderNumber" TEXT;

ALTER TABLE "Order"
  ALTER COLUMN "orderNumber" SET DEFAULT (
    'DN-' || to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Amsterdam', 'YYYY') || '-' ||
    lpad(nextval('"Order_orderNumber_seq"'::regclass)::text, 5, '0')
  );

CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
