// Soft opt-in from the checkout. A customer who keeps the (pre-ticked, untickable)
// newsletter box at checkout is subscribed once the order is paid: that is the sale the
// legal exception (AVG / Telecommunicatiewet art. 11.7, BE WER XII.13) is tied to.
// Someone who unsubscribed before is never subscribed again this way.

export type CheckoutOptInOrder = {
  id: string;
  contactEmail: string;
  contactName: string;
  shippingCity: string | null;
  shippingCountry: string | null;
  locale: string;
  newsletterOptIn: boolean;
  isTest: boolean;
};

export type CheckoutOptInDependencies = {
  /** The stored consent status for this address, or null when unknown. */
  existingStatus: (email: string) => Promise<"SUBSCRIBED" | "UNSUBSCRIBED" | "PENDING" | "CLEANED" | null>;
  /** Adds or updates the Mailchimp member without changing an existing member's status. */
  upsertMailchimpMember: (input: { email: string; firstName: string; lastName: string }) => Promise<"subscribed" | "unsubscribed" | "pending" | "cleaned" | string>;
  tagMailchimpMember: (email: string, tags: string[]) => Promise<void>;
  saveConsent: (input: {
    email: string;
    firstName: string;
    lastName: string;
    status: "SUBSCRIBED" | "UNSUBSCRIBED" | "PENDING" | "CLEANED";
    city: string | null;
    country: string | null;
    locale: "nl" | "en" | "fr";
  }) => Promise<void>;
};

export type CheckoutOptInResult =
  | { status: "skipped"; reason: "not-opted-in" | "test-order" | "previously-unsubscribed" }
  | { status: "subscribed" | "kept"; mailchimpStatus: string };

export const CUSTOMER_TAG = "Klant (soft opt-in)";

export function countryTag(country: string | null | undefined): string | null {
  return country === "NL" || country === "BE" ? `Land ${country}` : null;
}

export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

export async function subscribeCheckoutCustomer(order: CheckoutOptInOrder, dependencies: CheckoutOptInDependencies): Promise<CheckoutOptInResult> {
  if (!order.newsletterOptIn) return { status: "skipped", reason: "not-opted-in" };
  if (order.isTest) return { status: "skipped", reason: "test-order" };
  const email = order.contactEmail.trim().toLocaleLowerCase("nl-NL");
  const previous = await dependencies.existingStatus(email);
  if (previous === "UNSUBSCRIBED" || previous === "CLEANED") return { status: "skipped", reason: "previously-unsubscribed" };

  const { firstName, lastName } = splitName(order.contactName);
  const mailchimpStatus = await dependencies.upsertMailchimpMember({ email, firstName, lastName });
  // Mailchimp keeps an existing unsubscribe; mirror it instead of claiming a subscription.
  if (mailchimpStatus === "unsubscribed" || mailchimpStatus === "cleaned") {
    await dependencies.saveConsent({ email, firstName, lastName, status: mailchimpStatus === "cleaned" ? "CLEANED" : "UNSUBSCRIBED", city: order.shippingCity, country: order.shippingCountry, locale: localeOf(order.locale) });
    return { status: "skipped", reason: "previously-unsubscribed" };
  }
  const tags = [CUSTOMER_TAG, countryTag(order.shippingCountry)].filter((tag): tag is string => Boolean(tag));
  await dependencies.tagMailchimpMember(email, tags);
  await dependencies.saveConsent({
    email,
    firstName,
    lastName,
    status: mailchimpStatus === "pending" ? "PENDING" : "SUBSCRIBED",
    city: order.shippingCity,
    country: order.shippingCountry,
    locale: localeOf(order.locale),
  });
  return { status: previous === "SUBSCRIBED" ? "kept" : "subscribed", mailchimpStatus };
}

function localeOf(value: string): "nl" | "en" | "fr" {
  return value === "en" || value === "fr" ? value : "nl";
}
