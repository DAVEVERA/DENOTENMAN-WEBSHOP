import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { backfillAftersalesSteps } from "../lib/aftersales/defaults";

// AftersalesFlow.flowType carries a @@unique([flowType]) constraint (added
// alongside the particulier/zakelijk split), so this test can no longer
// create a fully disposable third flow row - at most one PARTICULIER and
// one ZAKELIJK flow can ever exist. It borrows the ZAKELIJK slot instead:
// snapshot whatever's there, delete it, run the scenario on a fresh
// throwaway flow of that same type, then restore the original flow and its
// steps exactly as they were.
test("compatibility release defers new stock enum writes until activation and preserves them on rollback", async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55435");
  assert.equal(url.pathname, "/notenman_release_qa");
  const previous = process.env.RELEASE_EXPANDED_ENUM_WRITES;

  const original = await prisma.aftersalesFlow.findUnique({
    where: { flowType: "ZAKELIJK" },
    include: { steps: true },
  });
  if (original) {
    const liveDeliveries = await prisma.aftersalesDelivery.count({
      where: { stepId: { in: original.steps.map((step) => step.id) } },
    });
    assert.equal(
      liveDeliveries,
      0,
      "refusing to delete the ZAKELIJK flow's steps: real AftersalesDelivery rows reference them (onDelete: Cascade would destroy delivery history)"
    );
    await prisma.aftersalesFlow.delete({ where: { id: original.id } });
  }

  const flow = await prisma.aftersalesFlow.create({
    data: { name: `QA rollback ${randomUUID()}`, flowType: "ZAKELIJK" },
  });
  try {
    for (const flag of [undefined, "false", "TRUE", "1"]) {
      if (flag === undefined) delete process.env.RELEASE_EXPANDED_ENUM_WRITES;
      else process.env.RELEASE_EXPANDED_ENUM_WRITES = flag;
      assert.equal(await backfillAftersalesSteps(flow.id, []), false);
      assert.equal(await prisma.aftersalesStep.count({ where: { flowId: flow.id } }), 0);
    }
    process.env.RELEASE_EXPANDED_ENUM_WRITES = "true";
    assert.equal(await backfillAftersalesSteps(flow.id, []), true);
    const active = await prisma.aftersalesFlow.findUniqueOrThrow({ where: { id: flow.id }, include: { steps: true } });
    assert.equal(active.steps.length, 1);
    assert.equal(active.steps[0].trigger, "BACK_IN_STOCK");
    process.env.RELEASE_EXPANDED_ENUM_WRITES = "false";
    assert.equal(await backfillAftersalesSteps(flow.id, []), false);
    const rollback = await prisma.aftersalesFlow.findUniqueOrThrow({ where: { id: flow.id }, include: { steps: true } });
    assert.deepEqual(rollback.steps, active.steps, "rollback keeps existing configured mail content readable and unchanged");
  } finally {
    if (previous === undefined) delete process.env.RELEASE_EXPANDED_ENUM_WRITES;
    else process.env.RELEASE_EXPANDED_ENUM_WRITES = previous;
    await prisma.aftersalesFlow.delete({ where: { id: flow.id } });
    if (original) {
      await prisma.aftersalesFlow.create({
        data: {
          id: original.id,
          name: original.name,
          flowType: original.flowType,
          isActive: original.isActive,
          logoUrl: original.logoUrl,
          createdAt: original.createdAt,
          updatedAt: original.updatedAt,
          steps: {
            create: original.steps.map((step) => ({
              id: step.id,
              trigger: step.trigger,
              name: step.name,
              position: step.position,
              enabled: step.enabled,
              delayMinutes: step.delayMinutes,
              content: step.content as object,
              createdAt: step.createdAt,
              updatedAt: step.updatedAt,
            })),
          },
        },
      });
    }
  }
});
