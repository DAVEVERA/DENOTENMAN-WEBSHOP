import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20261120093000_inbound_mail_and_manual_messages/migration.sql",
  "utf8"
);

test("the schema carries the inbound mail models and the manual message kind", () => {
  assert.match(
    schema,
    /enum InboundMessageStatus \{[^}]*NIEUW[^}]*BEANTWOORD[^}]*AFGEHANDELD[^}]*SPAM/s
  );
  assert.match(schema, /model InboundMessage \{/);
  assert.match(schema, /providerMessageId\s+String\s+@unique/);
  assert.match(schema, /model InboundAttachment \{/);
  assert.match(schema, /enum EmailDeliveryKind \{[^}]*MANUAL_MESSAGE/s);
});

test("reply tokens and message ids are unique where they must be", () => {
  // Two orders sharing a token would route one customer's reply to another's
  // thread, so the database has to refuse it rather than the application.
  const order = schema.slice(schema.indexOf("model Order {"), schema.indexOf("model AftersalesFlow {"));
  const business = schema.slice(schema.indexOf("model BusinessAccount {"));
  assert.match(order, /replyToken\s+String\?\s+@unique/);
  assert.match(business, /replyToken\s+String\?\s+@unique/);
  assert.match(schema, /messageId\s+String\?\s+@unique/);
  assert.match(schema, /threadKey\s+String\?/);
});

test("a removed order never takes the customer's words with it", () => {
  const model = schema.slice(
    schema.indexOf("model InboundMessage {"),
    schema.indexOf("model InboundAttachment {")
  );
  assert.match(model, /order\s+Order\?\s+@relation\([^)]*onDelete: SetNull/);
  assert.match(model, /businessAccount\s+BusinessAccount\?\s+@relation\([^)]*onDelete: SetNull/);
  assert.match(migration, /"InboundMessage_orderId_fkey"[\s\S]*ON DELETE SET NULL/);
});

test("the migration only expands, so an older revision keeps serving", () => {
  const statements = migration
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  assert.doesNotMatch(statements, /\bDROP\b/i);
  assert.doesNotMatch(statements, /\bSET NOT NULL\b/i);
  // A new enum value an older revision cannot deserialize is only ever written
  // once the new revision serves, which is why adding it here is safe.
  assert.match(statements, /ALTER TYPE "EmailDeliveryKind" ADD VALUE IF NOT EXISTS 'MANUAL_MESSAGE'/);
  assert.match(statements, /CREATE TABLE IF NOT EXISTS "InboundMessage"/);
  assert.match(statements, /CREATE TABLE IF NOT EXISTS "InboundAttachment"/);
});
