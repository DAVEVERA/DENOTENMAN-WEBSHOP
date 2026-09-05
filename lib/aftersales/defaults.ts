import "server-only";

import { prisma } from "@/lib/prisma";
import {
  defaultAftersalesDesign,
  AFTERSALES_TRIGGERS_BY_FLOW_TYPE,
  type AftersalesLocaleContent,
  type AftersalesStepContent,
  type AftersalesTriggerValue,
} from "@/lib/aftersales/schema";

const backInStock: Record<"nl" | "en" | "fr", AftersalesLocaleContent> = {
  nl: {
    subject: "{{product_name}} is weer verkrijgbaar",
    previewText: "{{product_name}} kan weer besteld worden bij De Notenman.",
    heading: "Goed nieuws: weer op voorraad",
    body: "Je vroeg ons om een seintje zodra dit product weer besteld kon worden.\n\n{{product_name}}\n\nDit is een eenmalige voorraadmelding waarvoor je jezelf hebt aangemeld.",
    buttonLabel: "Bekijk en bestel het product",
  },
  en: {
    subject: "{{product_name}} is available again",
    previewText: "{{product_name}} can be ordered again from De Notenman.",
    heading: "Good news: back in stock",
    body: "You asked us to let you know when this product could be ordered again.\n\n{{product_name}}\n\nThis is the one-time stock alert you requested.",
    buttonLabel: "View and order the product",
  },
  fr: {
    subject: "{{product_name}} est de nouveau disponible",
    previewText: "{{product_name}} peut de nouveau être commandé chez De Notenman.",
    heading: "Bonne nouvelle : de nouveau en stock",
    body: "Vous nous avez demandé de vous prévenir lorsque ce produit serait de nouveau disponible.\n\n{{product_name}}\n\nCeci est l'alerte de stock unique que vous avez demandée.",
    buttonLabel: "Voir et commander le produit",
  },
};

const businessOrderPaid: Record<"nl" | "en" | "fr", AftersalesLocaleContent> = {
  nl: {
    subject: "Betaling ontvangen voor {{business_name}}",
    previewText: "We hebben de betaling van bestelling {{order_number}} ontvangen.",
    heading: "Betaling ontvangen",
    body: "Beste {{contact_name}},\n\nWe hebben de betaling van bestelling {{order_number}} (totaal {{order_total}}) namens {{business_name}} in goede orde ontvangen.",
    buttonLabel: "Bekijk de bestelling",
  },
  en: {
    subject: "Payment received for {{business_name}}",
    previewText: "We received the payment for order {{order_number}}.",
    heading: "Payment received",
    body: "Dear {{contact_name}},\n\nWe have received the payment for order {{order_number}} (total {{order_total}}) on behalf of {{business_name}}.",
    buttonLabel: "View the order",
  },
  fr: {
    subject: "Paiement reçu pour {{business_name}}",
    previewText: "Nous avons reçu le paiement de la commande {{order_number}}.",
    heading: "Paiement reçu",
    body: "Cher {{contact_name}},\n\nNous avons bien reçu le paiement de la commande {{order_number}} (total {{order_total}}) pour {{business_name}}.",
    buttonLabel: "Voir la commande",
  },
};

const businessOrderFulfilled: Record<"nl" | "en" | "fr", AftersalesLocaleContent> = {
  nl: {
    subject: "Bestelling {{order_number}} van {{business_name}} is verzonden",
    previewText: "De bestelling is onderweg. Trackingcode: {{tracking_code}}.",
    heading: "Bestelling verzonden",
    body: "Beste {{contact_name}},\n\nDe bestelling {{order_number}} van {{business_name}} is verzonden.\n\nTrackingcode: {{tracking_code}}",
    buttonLabel: "Volg de zending",
  },
  en: {
    subject: "Order {{order_number}} for {{business_name}} has shipped",
    previewText: "The order is on its way. Tracking code: {{tracking_code}}.",
    heading: "Order shipped",
    body: "Dear {{contact_name}},\n\nOrder {{order_number}} for {{business_name}} has shipped.\n\nTracking code: {{tracking_code}}",
    buttonLabel: "Track the shipment",
  },
  fr: {
    subject: "La commande {{order_number}} de {{business_name}} a été expédiée",
    previewText: "La commande est en route. Code de suivi : {{tracking_code}}.",
    heading: "Commande expédiée",
    body: "Cher {{contact_name}},\n\nLa commande {{order_number}} de {{business_name}} a été expédiée.\n\nCode de suivi : {{tracking_code}}",
    buttonLabel: "Suivre l'envoi",
  },
};

/**
 * Seed content for a trigger's step the very first time it's created -
 * matches the copy that trigger used before it became editable, so nothing
 * visibly changes until an admin opens the editor and changes something.
 * ORDER_PAID/ORDER_FULFILLED have no entry here: those steps were seeded by
 * the original migration and are never created by this backfill path (see
 * FALLBACK_STEP_IDS in lib/aftersales/service.ts for their fallback
 * content). Every OTHER trigger in AFTERSALES_TRIGGERS must have an entry:
 * a flow can only ever be saved once every one of its own flow-type's
 * triggers has an enabled step (see aftersalesFlowInputSchema), so any
 * trigger reachable through backfillAftersalesSteps without a preset here
 * would make that flow permanently unsavable from the admin UI.
 */
export const AFTERSALES_STEP_DEFAULTS: Partial<Record<AftersalesTriggerValue, { name: string; content: AftersalesStepContent }>> = {
  BACK_IN_STOCK: {
    name: "Voorraadmelding",
    content: { locales: backInStock, design: defaultAftersalesDesign },
  },
  BUSINESS_ORDER_PAID: {
    name: "Zakelijke betaling ontvangen",
    content: { locales: businessOrderPaid, design: defaultAftersalesDesign },
  },
  BUSINESS_ORDER_FULFILLED: {
    name: "Zakelijke bestelling verzonden",
    content: { locales: businessOrderFulfilled, design: defaultAftersalesDesign },
  },
};

/**
 * Creates a step for any trigger belonging to this flow's own type that's
 * known to the app but not yet present on the flow (e.g. right after a
 * migration adds a new trigger, or right after a new flow type is
 * backfilled empty). Idempotent and safe to call on every page load -
 * findMany+createMany with skipDuplicates means a race between two admins
 * loading the page at once just results in one of them being a no-op,
 * never a duplicate step. Scoped to `flowType` so a PARTICULIER flow never
 * gets a business step seeded onto it, and vice versa - each flow only
 * ever receives steps for triggers it's actually allowed to hold.
 */
export async function backfillAftersalesSteps(
  flowId: string,
  flowType: "PARTICULIER" | "ZAKELIJK",
  existingTriggers: readonly AftersalesTriggerValue[]
): Promise<boolean> {
  // Reader-first rollout: old live revisions cannot deserialize this enum.
  // Existing steps remain readable when rolling back to this compatible build.
  if (process.env.RELEASE_EXPANDED_ENUM_WRITES !== "true") return false;
  const existing = new Set(existingTriggers);
  // Only triggers this flow type is missing AND that have seed content -
  // ORDER_PAID/ORDER_FULFILLED are seeded by the original migration, never
  // through this path, so they're excluded even though they belong to
  // PARTICULIER's trigger set.
  const missing = AFTERSALES_TRIGGERS_BY_FLOW_TYPE[flowType].filter(
    (trigger) => !existing.has(trigger) && trigger in AFTERSALES_STEP_DEFAULTS
  );
  if (missing.length === 0) return false;

  await prisma.aftersalesStep.createMany({
    data: missing.map((trigger, index) => {
      const preset = AFTERSALES_STEP_DEFAULTS[trigger]!;
      return {
        flowId,
        trigger,
        name: preset.name,
        position: existing.size + index,
        enabled: true,
        content: preset.content,
      };
    }),
    skipDuplicates: true,
  });
  return true;
}

/**
 * Creates the ZAKELIJK flow row (with no steps yet - the caller must
 * follow up with backfillAftersalesSteps for that flow's id) the first
 * time it's missing. Same reader-first rollout gate and idempotent
 * createMany+skipDuplicates pattern as backfillAftersalesSteps, so a
 * race between two admins loading the page at once is a no-op, never
 * a duplicate flow.
 */
export async function backfillAftersalesFlows(): Promise<boolean> {
  if (process.env.RELEASE_EXPANDED_ENUM_WRITES !== "true") return false;
  const existing = await prisma.aftersalesFlow.findMany({ select: { flowType: true } });
  const existingTypes = new Set(existing.map((flow) => flow.flowType));
  if (existingTypes.has("ZAKELIJK")) return false;

  await prisma.aftersalesFlow.createMany({
    data: [{ name: "Zakelijk", flowType: "ZAKELIJK", isActive: false }],
    skipDuplicates: true,
  });
  return true;
}
