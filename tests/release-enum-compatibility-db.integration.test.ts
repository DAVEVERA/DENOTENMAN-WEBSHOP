import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { backfillAftersalesSteps } from "../lib/aftersales/defaults";

test("compatibility release defers new stock enum writes until activation and preserves them on rollback", async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55435");
  assert.equal(url.pathname, "/notenman_release_qa");
  const previous = process.env.RELEASE_EXPANDED_ENUM_WRITES;
  const flow = await prisma.aftersalesFlow.create({ data: { name: `QA rollback ${randomUUID()}` } });
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
  }
});
