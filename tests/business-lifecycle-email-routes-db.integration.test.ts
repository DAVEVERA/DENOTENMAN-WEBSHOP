import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as getTemplates } from "../app/api/admin/marketing/business-lifecycle-emails/route";
import { PATCH as updateTemplate } from "../app/api/admin/marketing/business-lifecycle-emails/[kind]/route";

test("business lifecycle email routes require an authenticated admin", async () => {
  const getResponse = await getTemplates(
    new NextRequest("http://localhost/api/admin/marketing/business-lifecycle-emails")
  );
  assert.equal(getResponse.status, 401);

  const patchResponse = await updateTemplate(
    new NextRequest("http://localhost/api/admin/marketing/business-lifecycle-emails/invitation", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject: "s", heading: "h", bodyText: "b", buttonLabel: "k" }),
    }),
    { params: Promise.resolve({ kind: "invitation" }) }
  );
  assert.equal(patchResponse.status, 401);
});

test("the PATCH route validates the kind param and body with a strict zod schema before touching the database", async () => {
  const source = await readFile(
    "app/api/admin/marketing/business-lifecycle-emails/[kind]/route.ts",
    "utf8"
  );
  assert.match(source, /INVALID_KIND/);
  assert.match(source, /businessLifecycleEmailPatchSchema\.safeParse/);
  assert.match(source, /VALIDATION_ERROR/);
  assert.match(source, /recordAudit\(/);
  assert.match(source, /"BusinessLifecycleEmailContent"/);
  assert.match(source, /revalidatePath\("\/admin\/marketing\/service-en-support-zakelijk"\)/);
  assert.match(source, /businessLifecycleEmailContent\.upsert/);
});

test("the schema module used by the route is strict and shared, not redefined per route", async () => {
  const schemaSource = await readFile("lib/business-lifecycle-email-content-shared.ts", "utf8");
  assert.match(schemaSource, /businessLifecycleEmailPatchSchema[\s\S]*\.strict\(\)/);
});
