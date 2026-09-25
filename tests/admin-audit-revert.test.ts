import assert from "node:assert/strict";
import test from "node:test";
import { applyDeleteRevert } from "../lib/admin-audit";

// A fake Prisma model delegate that behaves like a soft-deleted row: the row
// still exists (findUnique returns it) with deletedAt set, mirroring
// BusinessAccount's soft delete (sets deletedAt instead of removing the row)
// while its audit entry is logged as "DELETE".
function fakeSoftDeletedDelegate(row: Record<string, unknown>) {
  let current: Record<string, unknown> | null = { ...row };
  const calls: { create: number; update: number } = { create: 0, update: 0 };
  return {
    calls,
    delegate: {
      async findUnique() {
        return current;
      },
      async update({ data }: { data: object }) {
        calls.update += 1;
        current = { ...(current as object), ...data };
        return current;
      },
      async create({ data }: { data: object }) {
        calls.create += 1;
        current = { ...data };
        return current;
      },
      async delete() {
        current = null;
        return current;
      },
    },
    get current() {
      return current;
    },
  };
}

test("reverting a DELETE entry for a soft-deleted row updates it back instead of crashing on create", async () => {
  const before = { id: "biz-1", companyName: "Kaaskraam", deletedAt: null };
  const softDeletedRow = { id: "biz-1", companyName: "Kaaskraam", deletedAt: "2026-09-10T00:00:00.000Z" };
  const fake = fakeSoftDeletedDelegate(softDeletedRow);

  await applyDeleteRevert(fake.delegate, "biz-1", before);

  assert.equal(fake.calls.update, 1, "must restore via update, not create, when the row still exists");
  assert.equal(fake.calls.create, 0, "must never attempt create against an existing row");
  assert.deepEqual(fake.current, before, "the row must be restored to its pre-delete snapshot, clearing deletedAt");
});

test("reverting a DELETE entry for a genuinely hard-deleted row still re-creates it", async () => {
  const before = { id: "qr-1", name: "Zomeractie" };
  const fake = fakeSoftDeletedDelegate(before);
  // Simulate a real hard delete: the row is actually gone.
  await fake.delegate.delete();

  await applyDeleteRevert(fake.delegate, "qr-1", before);

  assert.equal(fake.calls.create, 1, "a genuinely deleted row must be re-created");
  assert.equal(fake.calls.update, 0, "must never attempt update against a row that no longer exists");
  assert.deepEqual(fake.current, before);
});
