import "server-only";

import { prisma } from "@/lib/prisma";
import { defaultAftersalesDesign, type AftersalesLocaleContent, type AftersalesStepContent, type AftersalesTriggerValue } from "@/lib/aftersales/schema";

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

/**
 * Seed content for a trigger's step the very first time it's created -
 * matches the copy that trigger used before it became editable, so nothing
 * visibly changes until an admin opens the editor and changes something.
 */
export const AFTERSALES_STEP_DEFAULTS: Partial<Record<AftersalesTriggerValue, { name: string; content: AftersalesStepContent }>> = {
  BACK_IN_STOCK: {
    name: "Voorraadmelding",
    content: { locales: backInStock, design: defaultAftersalesDesign },
  },
};

/**
 * Creates a step for any trigger that's known to the app but not yet
 * present on this flow (e.g. right after a migration adds a new trigger).
 * Idempotent and safe to call on every page load - findMany+createMany
 * with skipDuplicates means a race between two admins loading the page at
 * once just results in one of them being a no-op, never a duplicate step.
 */
export async function backfillAftersalesSteps(
  flowId: string,
  existingTriggers: readonly AftersalesTriggerValue[]
): Promise<boolean> {
  // Reader-first rollout: old live revisions cannot deserialize this enum.
  // Existing steps remain readable when rolling back to this compatible build.
  if (process.env.RELEASE_EXPANDED_ENUM_WRITES !== "true") return false;
  const existing = new Set(existingTriggers);
  const missing = (Object.keys(AFTERSALES_STEP_DEFAULTS) as AftersalesTriggerValue[]).filter(
    (trigger) => !existing.has(trigger)
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
