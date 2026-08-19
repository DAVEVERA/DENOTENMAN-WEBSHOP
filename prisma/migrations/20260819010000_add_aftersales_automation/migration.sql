-- CreateEnum
CREATE TYPE "AftersalesTrigger" AS ENUM ('ORDER_PAID', 'ORDER_FULFILLED');

-- CreateEnum
CREATE TYPE "AftersalesDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "AftersalesFlow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AftersalesFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AftersalesStep" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "trigger" "AftersalesTrigger" NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AftersalesStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AftersalesDelivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "trigger" "AftersalesTrigger" NOT NULL,
    "status" "AftersalesDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerMessageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AftersalesDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AftersalesStep_flowId_trigger_key" ON "AftersalesStep"("flowId", "trigger");

-- CreateIndex
CREATE INDEX "AftersalesStep_flowId_position_idx" ON "AftersalesStep"("flowId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "AftersalesDelivery_orderId_stepId_trigger_key" ON "AftersalesDelivery"("orderId", "stepId", "trigger");

-- CreateIndex
CREATE INDEX "AftersalesDelivery_status_createdAt_idx" ON "AftersalesDelivery"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AftersalesDelivery_orderId_createdAt_idx" ON "AftersalesDelivery"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "AftersalesStep" ADD CONSTRAINT "AftersalesStep_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "AftersalesFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AftersalesDelivery" ADD CONSTRAINT "AftersalesDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AftersalesDelivery" ADD CONSTRAINT "AftersalesDelivery_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "AftersalesStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed a safe draft. Activation remains an explicit admin action.
INSERT INTO "AftersalesFlow" ("id", "name", "isActive", "createdAt", "updatedAt")
VALUES ('default-aftersales-flow', 'Bestelling en verzending', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "AftersalesStep" ("id", "flowId", "trigger", "name", "position", "enabled", "delayMinutes", "content", "createdAt", "updatedAt")
VALUES
(
  'order-paid-email',
  'default-aftersales-flow',
  'ORDER_PAID',
  'Bedankt voor je bestelling',
  0,
  true,
  0,
  '{
    "nl":{"subject":"Bestelling {{order_number}} is bevestigd — De Notenman","previewText":"We hebben je betaling ontvangen.","heading":"Bedankt voor je bestelling, {{first_name}}!","body":"We hebben je betaling ontvangen en gaan met je bestelling aan de slag. Je bestelgegevens staan hieronder.","buttonLabel":"Bekijk je bestelling"},
    "en":{"subject":"Order {{order_number}} is confirmed — De Notenman","previewText":"We have received your payment.","heading":"Thanks for your order, {{first_name}}!","body":"We have received your payment and will start preparing your order. Your order details are shown below.","buttonLabel":"View your order"},
    "fr":{"subject":"Commande {{order_number}} confirmée — De Notenman","previewText":"Nous avons bien reçu votre paiement.","heading":"Merci pour votre commande, {{first_name}} !","body":"Nous avons reçu votre paiement et préparons votre commande. Vous trouverez les détails ci-dessous.","buttonLabel":"Voir votre commande"}
  }'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'order-fulfilled-email',
  'default-aftersales-flow',
  'ORDER_FULFILLED',
  'Bestelling is verzonden',
  1,
  true,
  0,
  '{
    "nl":{"subject":"Bestelling {{order_number}} is verzonden — De Notenman","previewText":"Je bestelling is onderweg.","heading":"Je bestelling is onderweg, {{first_name}}","body":"Goed nieuws: je bestelling is verzonden. Gebruik de knop hieronder om de actuele bezorgstatus te bekijken.","buttonLabel":"Volg je bestelling"},
    "en":{"subject":"Order {{order_number}} has shipped — De Notenman","previewText":"Your order is on its way.","heading":"Your order is on its way, {{first_name}}","body":"Good news: your order has shipped. Use the button below to view the latest delivery status.","buttonLabel":"Track your order"},
    "fr":{"subject":"Commande {{order_number}} expédiée — De Notenman","previewText":"Votre commande est en route.","heading":"Votre commande est en route, {{first_name}}","body":"Bonne nouvelle : votre commande a été expédiée. Utilisez le bouton ci-dessous pour suivre la livraison.","buttonLabel":"Suivre ma commande"}
  }'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
