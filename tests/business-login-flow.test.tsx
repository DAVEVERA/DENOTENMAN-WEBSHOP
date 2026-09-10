import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the email-link request is the primary, always-visible login path and password login is the secondary, collapsed one", () => {
  const source = readFileSync("app/[locale]/zakelijk/inloggen/BusinessLoginOptions.tsx", "utf8");

  const emailFormIndex = source.indexOf("<BusinessLoginLinkRequestForm");
  const passwordToggleIndex = source.indexOf("Ik heb al een wachtwoord");
  assert.ok(emailFormIndex > -1, "the email-link request form must render");
  assert.ok(passwordToggleIndex > -1, "the 'already have a password' toggle must exist");
  assert.ok(emailFormIndex < passwordToggleIndex, "the email-link form must render before the password-login toggle");

  assert.match(source, /<BusinessLoginLinkRequestForm\s*\/>/);
  assert.doesNotMatch(source, /showLinkRequest/, "the email-link form must no longer be hidden behind its own toggle");
  assert.match(source, /showPasswordLogin/, "password login must now be the option behind a toggle");
  assert.match(source, /Ik heb al een wachtwoord/);
});

test("the invitation screen sets a password before entering the portal, with a skip option", () => {
  const source = readFileSync("app/[locale]/zakelijk/inloggen/BusinessInvitationLoginForm.tsx", "utf8");

  assert.match(source, /fetch\("\/api\/business\/auth\/accept"/);
  assert.match(source, /fetch\("\/api\/business\/auth\/password"/);
  assert.match(source, /method:\s*"PUT"/);
  assert.match(source, /JSON\.stringify\(\{\s*password\s*\}\)/);

  // Validation mirrors BusinessPasswordSettings.tsx exactly.
  assert.match(source, /Gebruik minimaal 8 tekens\./);
  assert.match(source, /De wachtwoorden komen niet overeen\./);
  assert.match(source, /minLength=\{8\}/);

  // Redirect into the portal happens for both the password-set and skip paths.
  assert.match(source, /router\.replace\(`\/\$\{locale\}\/zakelijk`\)/);
  assert.match(source, /router\.refresh\(\)/);

  // A skip path exists so the emailed link remains a valid login method on its own.
  assert.match(source, /Later instellen, ik gebruik de e-maillink/);

  const acceptIndex = source.indexOf('fetch("/api/business/auth/accept"');
  const passwordStepIndex = source.indexOf('setStep("password")');
  const redirectIndex = source.lastIndexOf("router.replace");
  assert.ok(acceptIndex > -1 && passwordStepIndex > -1 && redirectIndex > -1);
  assert.ok(acceptIndex < passwordStepIndex, "accepting the invitation must happen before the password step is shown");
});

test("the login-link request form keeps its enumeration-safe wording and required label", () => {
  const source = readFileSync("app/[locale]/zakelijk/inloggen/BusinessLoginLinkRequestForm.tsx", "utf8");

  assert.match(source, /Zakelijk e-mailadres/);
  assert.doesNotMatch(source, /ontvangt u|Controleer uw/, "copy must use je-vorm, not the formal u-vorm");
  // Still never confirms or denies whether the email address exists.
  assert.match(source, /Staat dit e-mailadres bij ons geregistreerd/);
});
