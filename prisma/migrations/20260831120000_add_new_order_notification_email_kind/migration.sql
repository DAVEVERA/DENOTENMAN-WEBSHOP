-- Keep the webshop-owner notification separate from customer-facing order mail.
ALTER TYPE "EmailDeliveryKind" ADD VALUE IF NOT EXISTS 'NEW_ORDER_NOTIFICATION';
