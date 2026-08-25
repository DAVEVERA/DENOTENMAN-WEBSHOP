import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NewsletterSignup } from "../components/home/NewsletterSignup";

const copy = {
  eyebrow: "Blijf op de hoogte",
  title: "Nieuws uit de kraam",
  intro: "Ontvang af en toe productnieuws en marktnieuws.",
  emailLabel: "E-mailadres",
  emailPlaceholder: "jij@voorbeeld.nl",
  consentText: "Ja, ik geef toestemming voor de nieuwsbrief.",
  privacyLinkLabel: "Lees het privacybeleid",
  submit: "Aanmelden",
  submitting: "Aanmelden…",
  success: "Controleer je inbox om je aanmelding te bevestigen.",
  invalid: "Controleer je e-mailadres en toestemming.",
  unavailable: "Aanmelden lukt tijdelijk niet. Probeer het later opnieuw.",
  rateLimited: "Je hebt het te vaak geprobeerd. Wacht even en probeer opnieuw.",
};

test("newsletter form is accessible, mobile-first and contains consent plus honeypot", () => {
  const html = renderToStaticMarkup(
    <NewsletterSignup
      locale="nl"
      privacyHref="/nl/paginas/privacybeleid"
      copy={copy}
    />,
  );

  assert.match(html, /id="newsletter-signup"/);
  assert.match(html, /type="email"/);
  assert.match(html, /autoComplete="email"/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /name="website"/);
  assert.match(html, /tabindex="-1"/);
  assert.match(html, /min-h-12/);
  assert.match(html, /focus-visible:ring-2/);
  assert.match(html, /text-body-md leading-6/);
  assert.match(html, /aria-describedby="newsletter-message"/);
  assert.match(html, /id="newsletter-message"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /href="\/nl\/paginas\/privacybeleid"/);
});
