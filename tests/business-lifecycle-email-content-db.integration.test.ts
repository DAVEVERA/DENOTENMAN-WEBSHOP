import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../lib/prisma";
import { getBusinessLifecycleEmailContent } from "../lib/business-lifecycle-email-content";
import { BUSINESS_LIFECYCLE_EMAIL_DEFAULTS } from "../lib/business-lifecycle-email-content-shared";

test("falls back to the hardcoded defaults when no admin row exists yet, and prefers a customized row once one is saved", async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55435");
  assert.equal(url.pathname, "/notenman_release_qa");

  await prisma.businessLifecycleEmailContent.deleteMany({ where: { kind: "INVITATION" } });
  try {
    const beforeCustomization = await getBusinessLifecycleEmailContent("INVITATION");
    assert.deepEqual(beforeCustomization, BUSINESS_LIFECYCLE_EMAIL_DEFAULTS.INVITATION);

    await prisma.businessLifecycleEmailContent.create({
      data: {
        kind: "INVITATION",
        subject: "Aangepast onderwerp",
        heading: "Aangepaste kop {contactName}",
        bodyText: "Aangepaste tekst voor {companyName}.",
        buttonLabel: null,
      },
    });

    const afterCustomization = await getBusinessLifecycleEmailContent("INVITATION");
    assert.equal(afterCustomization.subject, "Aangepast onderwerp");
    assert.equal(afterCustomization.heading, "Aangepaste kop {contactName}");
    assert.equal(afterCustomization.bodyText, "Aangepaste tekst voor {companyName}.");
    // A null buttonLabel on the row still falls back to the default label.
    assert.equal(afterCustomization.buttonLabel, BUSINESS_LIFECYCLE_EMAIL_DEFAULTS.INVITATION.buttonLabel);
  } finally {
    await prisma.businessLifecycleEmailContent.deleteMany({ where: { kind: "INVITATION" } });
  }
});
