import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { dispatchAftersalesEvent } from "../lib/aftersales/service";
import { isAftersalesSchemaUnavailable } from "../lib/aftersales/database";
import { prisma } from "../lib/prisma";

test("treats an unapplied aftersales migration as a disabled flow", async () => {
  const delegate = prisma.aftersalesFlow as unknown as {
    findFirst: () => Promise<never>;
  };
  const originalFindFirst = delegate.findFirst;
  delegate.findFirst = async () => {
    throw new Prisma.PrismaClientKnownRequestError("AftersalesFlow is missing", {
      code: "P2021",
      clientVersion: Prisma.prismaVersion.client,
      meta: { modelName: "AftersalesFlow", table: "public.AftersalesFlow" },
    });
  };

  try {
    const result = await dispatchAftersalesEvent(
      "non-existent-order-for-schema-check",
      "ORDER_PAID"
    );
    assert.deepEqual(result, { status: "disabled" });
  } finally {
    delegate.findFirst = originalFindFirst;
  }
});

test("does not hide a missing non-aftersales table", () => {
  const error = new Prisma.PrismaClientKnownRequestError("Order is missing", {
    code: "P2021",
    clientVersion: Prisma.prismaVersion.client,
    meta: { modelName: "Order", table: "public.Order" },
  });

  assert.equal(isAftersalesSchemaUnavailable(error), false);
});

test("recognizes Prisma P2021 for an aftersales table", () => {
  const error = new Prisma.PrismaClientKnownRequestError("AftersalesFlow is missing", {
    code: "P2021",
    clientVersion: Prisma.prismaVersion.client,
    meta: { modelName: "AftersalesFlow", table: "public.AftersalesFlow" },
  });

  assert.equal(isAftersalesSchemaUnavailable(error), true);
});
