import assert from "node:assert/strict";
import test from "node:test";
import {
  BUSINESS_LIFECYCLE_EMAIL_DEFAULTS,
  businessLifecycleEmailPatchSchema,
  substituteBusinessLifecycleTokens,
} from "../lib/business-lifecycle-email-content-shared";

test("defaults match the previously hardcoded invitation and invoice copy", () => {
  assert.equal(
    BUSINESS_LIFECYCLE_EMAIL_DEFAULTS.INVITATION.subject,
    "Uitnodiging voor de zakelijke omgeving van De Notenman"
  );
  assert.equal(BUSINESS_LIFECYCLE_EMAIL_DEFAULTS.INVITATION.heading, "Welkom bij De Notenman zakelijk, {contactName}");
  assert.match(BUSINESS_LIFECYCLE_EMAIL_DEFAULTS.INVITATION.bodyText, /^Fedor heeft een zakelijke omgeving voor \{companyName\} klaargezet\./);
  assert.equal(BUSINESS_LIFECYCLE_EMAIL_DEFAULTS.INVITATION.buttonLabel, "Activeer mijn zakelijke omgeving");

  assert.equal(BUSINESS_LIFECYCLE_EMAIL_DEFAULTS.INVOICE.subject, "Factuur {invoiceNumber} - De Notenman");
  assert.equal(BUSINESS_LIFECYCLE_EMAIL_DEFAULTS.INVOICE.heading, "Factuur {invoiceNumber}");
  assert.equal(
    BUSINESS_LIFECYCLE_EMAIL_DEFAULTS.INVOICE.bodyText,
    "Beste {recipientName}, hierbij de factuur voor de betaalde bestelling van {companyName}."
  );
  assert.equal(BUSINESS_LIFECYCLE_EMAIL_DEFAULTS.INVOICE.buttonLabel, "Factuur downloaden (PDF)");
});

test("substituteBusinessLifecycleTokens replaces every known {token} occurrence", () => {
  const result = substituteBusinessLifecycleTokens(
    "Welkom bij De Notenman zakelijk, {contactName} ({companyName})",
    { contactName: "Fedor", companyName: "De Notenman B.V." }
  );
  assert.equal(result, "Welkom bij De Notenman zakelijk, Fedor (De Notenman B.V.)");
});

test("substituteBusinessLifecycleTokens leaves unknown tokens untouched instead of dropping them", () => {
  const result = substituteBusinessLifecycleTokens("Factuur {invoiceNumber} voor {unknownToken}", {
    invoiceNumber: "NL0031",
  });
  assert.equal(result, "Factuur NL0031 voor {unknownToken}");
});

test("substituteBusinessLifecycleTokens does not treat a substituted value as further template syntax", () => {
  const result = substituteBusinessLifecycleTokens("Hoi {contactName}", { contactName: "{companyName}" });
  assert.equal(result, "Hoi {companyName}");
});

test("PATCH schema rejects an empty subject and a missing button label is allowed only as null/omitted", () => {
  assert.equal(
    businessLifecycleEmailPatchSchema.safeParse({
      subject: "",
      heading: "Kop",
      bodyText: "Tekst",
      buttonLabel: "Verstuur",
    }).success,
    false
  );
  assert.equal(
    businessLifecycleEmailPatchSchema.safeParse({
      subject: "Onderwerp",
      heading: "Kop",
      bodyText: "Tekst",
    }).success,
    true
  );
  assert.equal(
    businessLifecycleEmailPatchSchema.safeParse({
      subject: "Onderwerp",
      heading: "Kop",
      bodyText: "Tekst",
      buttonLabel: null,
    }).success,
    true
  );
});

test("PATCH schema is strict and rejects unknown fields and over-length values", () => {
  assert.equal(
    businessLifecycleEmailPatchSchema.safeParse({
      subject: "Onderwerp",
      heading: "Kop",
      bodyText: "Tekst",
      buttonLabel: "Knop",
      extraField: "not allowed",
    }).success,
    false
  );
  assert.equal(
    businessLifecycleEmailPatchSchema.safeParse({
      subject: "a".repeat(201),
      heading: "Kop",
      bodyText: "Tekst",
      buttonLabel: "Knop",
    }).success,
    false
  );
  assert.equal(
    businessLifecycleEmailPatchSchema.safeParse({
      subject: "Onderwerp",
      heading: "Kop",
      bodyText: "a".repeat(2001),
      buttonLabel: "Knop",
    }).success,
    false
  );
  assert.equal(
    businessLifecycleEmailPatchSchema.safeParse({
      subject: "Onderwerp",
      heading: "Kop",
      bodyText: "Tekst",
      buttonLabel: "a".repeat(61),
    }).success,
    false
  );
});
