import "server-only";

import { prisma } from "@/lib/prisma";
import {
  AFTERSALES_TRIGGERS_BY_FLOW_TYPE,
  resolveLegacyStepContent,
  type AftersalesTriggerValue,
} from "@/lib/aftersales/schema";
// Seed copy lives in a Prisma-free module so it stays unit-testable without a
// database; re-exported here because this module is its historical home.
import { AFTERSALES_STEP_DEFAULTS } from "@/lib/aftersales/step-defaults";

export { AFTERSALES_STEP_DEFAULTS };

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
        // A step with a hand-built canvas ships it as-is; the rest are derived.
        content: preset.resolved ?? resolveLegacyStepContent(preset.content),
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
