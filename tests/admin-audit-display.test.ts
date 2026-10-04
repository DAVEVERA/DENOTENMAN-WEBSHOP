import assert from "node:assert/strict";
import test from "node:test";
import {
  auditSummary,
  formatAuditValue,
  getAuditChanges,
  redactAuditTechnicalValue,
} from "../lib/admin-audit-display";

test("audit summaries and changes use human Dutch labels", () => {
  const entry = {
    action: "UPDATE",
    entityType: "BusinessAccount",
    entityId: "technical-id",
    before: { companyName: "Oud", status: "PENDING", updatedAt: "2026-10-04T09:00:00.000Z" },
    after: { companyName: "Nieuw", status: "APPROVED", updatedAt: "2026-10-04T10:00:00.000Z" },
  };

  assert.equal(auditSummary(entry), "Zakelijke klant Nieuw bijgewerkt.");
  assert.deepEqual(getAuditChanges(entry.before, entry.after), [
    { key: "companyName", label: "Bedrijfsnaam", before: "Oud", after: "Nieuw" },
    { key: "status", label: "Status", before: "In afwachting", after: "Goedgekeurd" },
  ]);
});
test("audit dates are explicitly rendered in Amsterdam time", () => {
  assert.match(formatAuditValue("deletedAt", "2026-03-29T00:30:00.000Z"), /01:30/u);
  assert.match(formatAuditValue("deletedAt", "2026-03-29T01:30:00.000Z"), /03:30/u);
});

test("technical audit details recursively redact credentials", () => {
  assert.deepEqual(redactAuditTechnicalValue({
    id: "visible-technical-id",
    apiKey: "secret",
    nested: { accessToken: "token", label: "safe" },
  }), {
    id: "visible-technical-id",
    apiKey: "[AFGESCHERMD]",
    nested: { accessToken: "[AFGESCHERMD]", label: "safe" },
  });
});
