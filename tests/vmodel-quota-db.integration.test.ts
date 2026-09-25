import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { createVModelCampaignJob } from "../lib/design-studio/vmodel-service";
import { DesignStudioError } from "../lib/design-studio/service";
import { VModelError } from "../lib/design-studio/vmodel-provider";

function requireLocalQa() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55435");
  assert.equal(url.pathname, "/notenman_release_qa");
}

// Mirrors lib/design-studio/service.ts#amsterdamDayKey so the test can read
// back the exact DesignProviderUsage row the service writes to.
function amsterdamDayKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

async function vmodelAttempts(): Promise<number> {
  const row = await prisma.designProviderUsage.findUnique({
    where: { dayKey_provider: { dayKey: amsterdamDayKey(), provider: "VMODEL" } },
  });
  return row?.attempts ?? 0;
}

test("VModel reserves before paid calls, releases definite rejections and retains ambiguous attempts", async () => {
  requireLocalQa();
  const previousApiKey = process.env.VMODEL_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.VMODEL_API_KEY = "test-secret";
  const suffix = randomUUID();
  const usageKey = { dayKey: amsterdamDayKey(), provider: "VMODEL" as const };
  const previousUsage = await prisma.designProviderUsage.findUnique({ where: { dayKey_provider: usageKey } });
  async function setAttempts(attempts: number) {
    await prisma.designProviderUsage.upsert({
      where: { dayKey_provider: usageKey },
      create: { ...usageKey, attempts },
      update: { attempts },
    });
  }

  const admin = await prisma.adminUser.create({
    data: { username: `vmodel-qa-${suffix}`, passwordHash: "not-used", name: "VModel QA", role: "OWNER" },
  });
  const product = await prisma.product.create({
    data: { slug: `vmodel-qa-${suffix}`, sku: `VMODEL-QA-${suffix}`, basePriceCents: 100 },
  });
  const image = await prisma.productImage.create({
    data: { productId: product.id, storageKey: `products/${product.id}/source.webp` },
  });

  const baseOptions = {
    productId: product.id,
    imageId: image.id,
    modelId: "nano-banana-2" as const,
    preset: "hero" as const,
    aspectRatio: "16:9" as const,
    quality: "high" as const,
    brief: "",
  };

  try {
    await setAttempts(0);
    const attemptsBeforeFailure = await vmodelAttempts();
    globalThis.fetch = (async () => new Response("rejected", { status: 400 })) as typeof fetch;
    await assert.rejects(
      createVModelCampaignJob({
        adminUserId: admin.id,
        idempotencyKey: `vmodel-qa-fail-${suffix}`,
        options: baseOptions,
      }),
      (error: unknown) => error instanceof DesignStudioError || error instanceof VModelError,
    );
    assert.equal(
      await vmodelAttempts(),
      attemptsBeforeFailure,
      "a failed VModel task creation must not consume a daily attempt",
    );
    const failedJob = await prisma.designJob.findUniqueOrThrow({ where: { idempotencyKey: `vmodel-qa-fail-${suffix}` } });
    assert.equal(failedJob.status, "FAILED");

    const attemptsBeforeSuccess = await vmodelAttempts();
    globalThis.fetch = (async () => Response.json({ code: 200, result: { task_id: `vmodel-qa-task-${suffix}` } })) as typeof fetch;
    const result = await createVModelCampaignJob({
      adminUserId: admin.id,
      idempotencyKey: `vmodel-qa-success-${suffix}`,
      options: baseOptions,
    });
    assert.equal(result.replayed, false);
    assert.equal(result.job.status, "PROCESSING");
    assert.equal(
      await vmodelAttempts(),
      attemptsBeforeSuccess + 1,
      "a successful VModel task creation must consume exactly one daily attempt",
    );
    const succeededJob = await prisma.designJob.findUniqueOrThrow({ where: { idempotencyKey: `vmodel-qa-success-${suffix}` } });
    assert.equal(succeededJob.providerRequestId, `vmodel-qa-task-${suffix}`);

    for (const [name, response] of [
      ["timeout", async () => { throw new DOMException("timeout", "TimeoutError"); }],
      ["unavailable", async () => { throw new TypeError("network failure"); }],
      ["server-error", async () => new Response("ambiguous", { status: 500 })],
      ["malformed", async () => Response.json({ invalid: true })],
    ] as const) {
      const before = await vmodelAttempts();
      globalThis.fetch = response as typeof fetch;
      await assert.rejects(createVModelCampaignJob({
        adminUserId: admin.id, idempotencyKey: `vmodel-qa-${name}-${suffix}`, options: baseOptions,
      }), VModelError);
      assert.equal(await vmodelAttempts(), before + 1, `${name} must retain its reservation`);
    }

    let providerCalls = 0;
    globalThis.fetch = (async () => {
      providerCalls += 1;
      return Response.json({ code: 200, result: { task_id: `vmodel-concurrent-${providerCalls}` } });
    }) as typeof fetch;
    await setAttempts(25);
    await assert.rejects(createVModelCampaignJob({
      adminUserId: admin.id, idempotencyKey: `vmodel-qa-full-${suffix}`, options: baseOptions,
    }), (error: unknown) => error instanceof DesignStudioError && error.code === "DAILY_LIMIT");
    assert.equal(providerCalls, 0, "an exhausted quota must block the paid call");

    await setAttempts(24);
    const competing = await Promise.allSettled(Array.from({ length: 5 }, (_, index) =>
      createVModelCampaignJob({
        adminUserId: admin.id, idempotencyKey: `vmodel-qa-concurrent-${index}-${suffix}`, options: baseOptions,
      })
    ));
    assert.equal(competing.filter((result) => result.status === "fulfilled").length, 1);
    for (const result of competing) {
      if (result.status === "rejected") {
        assert.ok(result.reason instanceof DesignStudioError);
        assert.equal(result.reason.code, "DAILY_LIMIT");
      }
    }
    assert.equal(providerCalls, 1, "only the winner may purchase a task");
    assert.equal(await vmodelAttempts(), 25);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiKey === undefined) delete process.env.VMODEL_API_KEY;
    else process.env.VMODEL_API_KEY = previousApiKey;
    await prisma.designJob.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.adminUser.delete({ where: { id: admin.id } });
    if (previousUsage) await setAttempts(previousUsage.attempts);
    else await prisma.designProviderUsage.deleteMany({ where: usageKey });
  }
});
