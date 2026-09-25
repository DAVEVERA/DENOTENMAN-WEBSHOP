import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST as revertAuditLogEntry } from "../app/api/admin/audit-log/[id]/revert/route";
import { isSameOriginMutation } from "../lib/admin-request-security";

const routeSource = readFileSync(
  join(process.cwd(), "app/api/admin/audit-log/[id]/revert/route.ts"),
  "utf8",
);
const auditLibSource = readFileSync(join(process.cwd(), "lib/admin-audit.ts"), "utf8");
const schemaSource = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");

test("revert route requires an authenticated admin session", async () => {
  const response = await revertAuditLogEntry(
    new NextRequest("http://localhost/api/admin/audit-log/missing/revert", { method: "POST" }),
    { params: Promise.resolve({ id: "missing" }) },
  );
  assert.equal(response.status, 401, "reverting an audit entry requires an authenticated admin");
});

test("revert route blocks STAFF-level admins the same way business-account deletion does", () => {
  assert.match(routeSource, /admin\.role === "STAFF"/, "revert must reject STAFF-level admins");
  assert.match(routeSource, /FORBIDDEN/);
  const roleCheckIndex = routeSource.indexOf('admin.role === "STAFF"');
  const revertCallIndex = routeSource.indexOf("revertAuditEntry(admin");
  assert.ok(roleCheckIndex > -1 && revertCallIndex > -1 && roleCheckIndex < revertCallIndex,
    "the role check must run before the destructive revert call");
});

test("revert route rejects cross-origin mutations before touching the database", () => {
  assert.match(routeSource, /isSameOriginMutation\(request\)/);
  assert.match(routeSource, /INVALID_ORIGIN/);
  const originCheckIndex = routeSource.indexOf("isSameOriginMutation(request)");
  const revertCallIndex = routeSource.indexOf("revertAuditEntry(admin");
  assert.ok(originCheckIndex > -1 && revertCallIndex > -1 && originCheckIndex < revertCallIndex,
    "the origin check must run before the destructive revert call");
});

test("same-origin guard used by the revert route rejects a forged cross-site origin", () => {
  const sameOrigin = new NextRequest("https://internal/api/admin/audit-log/entry-1/revert", {
    method: "POST",
    headers: { origin: "https://admin.denotenman.nl", "x-forwarded-host": "admin.denotenman.nl", "x-forwarded-proto": "https" },
  });
  const crossSite = new NextRequest("https://internal/api/admin/audit-log/entry-1/revert", {
    method: "POST",
    headers: { origin: "https://attacker.example", "x-forwarded-host": "admin.denotenman.nl", "x-forwarded-proto": "https" },
  });
  assert.equal(isSameOriginMutation(sameOrigin), true);
  assert.equal(isSameOriginMutation(crossSite), false);
});

test("AUDITABLE_MODELS only lists entity types that actually exist in the schema", () => {
  const modelsMatch = auditLibSource.match(/const AUDITABLE_MODELS = \[([\s\S]*?)\] as const;/);
  assert.ok(modelsMatch, "AUDITABLE_MODELS declaration not found");
  const models = Array.from(modelsMatch[1].matchAll(/"([A-Za-z]+)"/g)).map((m) => m[1]);
  assert.ok(models.length > 0);
  assert.ok(!models.includes("Quote"), "Quote has no matching Prisma model and must not be revertible");
  for (const model of models) {
    assert.match(schemaSource, new RegExp("model " + model + "[ {]"), `AUDITABLE_MODELS references "${model}" but no such Prisma model exists`);
  }
});
