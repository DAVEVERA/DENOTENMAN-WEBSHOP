import {
  defaultAftersalesDesign,
  type AftersalesLegacyLocaleContent,
  type AftersalesLegacyStepContent,
  type AftersalesTriggerValue,
} from "@/lib/aftersales/schema";

const backInStock: Record<"nl" | "en" | "fr", AftersalesLegacyLocaleContent> = {
  nl: {
    subject: "{{product_name}} is weer verkrijgbaar",
    previewText: "{{product_name}} kan weer besteld worden bij De Notenman.",
    heading: "Goed nieuws: weer op voorraad",
    body: "Je vroeg ons om een seintje zodra dit product weer besteld kon worden.\n\n{{product_name}}\n\nDit is een eenmalige voorraadmelding waarvoor je jezelf hebt aangemeld.",
    buttonLabel: "Bekijk en bestel het product",
  },
  en: {
    subject: "{{product_name}} is available again",
    previewText: "{{product_name}} can be ordered again from De Notenman.",
    heading: "Good news: back in stock",
    body: "You asked us to let you know when this product could be ordered again.\n\n{{product_name}}\n\nThis is the one-time stock alert you requested.",
    buttonLabel: "View and order the product",
  },
  fr: {
    subject: "{{product_name}} est de nouveau disponible",
    previewText: "{{product_name}} peut de nouveau être commandé chez De Notenman.",
    heading: "Bonne nouvelle : de nouveau en stock",
    body: "Vous nous avez demandé de vous prévenir lorsque ce produit serait de nouveau disponible.\n\n{{product_name}}\n\nCeci est l'alerte de stock unique que vous avez demandée.",
    buttonLabel: "Voir et commander le produit",
  },
};

const businessOrderPaid: Record<"nl" | "en" | "fr", AftersalesLegacyLocaleContent> = {
  nl: {
    subject: "Betaling ontvangen voor {{business_name}}",
    previewText: "We hebben de betaling van bestelling {{order_number}} ontvangen.",
    heading: "Betaling ontvangen",
    body: "Beste {{contact_name}},\n\nWe hebben de betaling van bestelling {{order_number}} (totaal {{order_total}}) namens {{business_name}} in goede orde ontvangen.",
    buttonLabel: "Bekijk de bestelling",
  },
  en: {
    subject: "Payment received for {{business_name}}",
    previewText: "We received the payment for order {{order_number}}.",
    heading: "Payment received",
    body: "Dear {{contact_name}},\n\nWe have received the payment for order {{order_number}} (total {{order_total}}) on behalf of {{business_name}}.",
    buttonLabel: "View the order",
  },
  fr: {
    subject: "Paiement reçu pour {{business_name}}",
    previewText: "Nous avons reçu le paiement de la commande {{order_number}}.",
    heading: "Paiement reçu",
    body: "Cher {{contact_name}},\n\nNous avons bien reçu le paiement de la commande {{order_number}} (total {{order_total}}) pour {{business_name}}.",
    buttonLabel: "Voir la commande",
  },
};

const businessOrderFulfilled: Record<"nl" | "en" | "fr", AftersalesLegacyLocaleContent> = {
  nl: {
    subject: "Bestelling {{order_number}} van {{business_name}} is verzonden",
    previewText: "De bestelling is onderweg. Trackingcode: {{tracking_code}}.",
    heading: "Bestelling verzonden",
    body: "Beste {{contact_name}},\n\nDe bestelling {{order_number}} van {{business_name}} is verzonden.\n\nTrackingcode: {{tracking_code}}",
    buttonLabel: "Volg de zending",
  },
  en: {
    subject: "Order {{order_number}} for {{business_name}} has shipped",
    previewText: "The order is on its way. Tracking code: {{tracking_code}}.",
    heading: "Order shipped",
    body: "Dear {{contact_name}},\n\nOrder {{order_number}} for {{business_name}} has shipped.\n\nTracking code: {{tracking_code}}",
    buttonLabel: "Track the shipment",
  },
  fr: {
    subject: "La commande {{order_number}} de {{business_name}} a été expédiée",
    previewText: "La commande est en route. Code de suivi : {{tracking_code}}.",
    heading: "Commande expédiée",
    body: "Cher {{contact_name}},\n\nLa commande {{order_number}} de {{business_name}} a été expédiée.\n\nCode de suivi : {{tracking_code}}",
    buttonLabel: "Suivre l'envoi",
  },
};

// Variant D of the approved design: the order line, then the Google block with
// its own question and button label. "Bent u tevreden over onze service?" and
// "Laat een review achter" are fixed by that design and are not ours to reword.
// The opt-out is reply-based: this mail has no unsubscribe-link infrastructure,
// and a line pointing at a link that does not exist would be worse than none.
const reviewRequest: Record<"nl" | "en" | "fr", AftersalesLegacyLocaleContent> = {
  nl: {
    subject: "Je pakket is bezorgd",
    previewText: "Laat in een minuut weten hoe het ging.",
    heading: "Je pakket is bezorgd, {{first_name}}",
    body: "Bestelling {{order_number}} is afgeleverd.\n\nBent u tevreden over onze service?\n\nJe kunt je voor deze verzoeken afmelden door op deze mail te antwoorden.",
    buttonLabel: "Laat een review achter",
  },
  en: {
    subject: "Your parcel has been delivered",
    previewText: "Tell us how it went; it takes a minute.",
    heading: "Your parcel has been delivered, {{first_name}}",
    body: "Order {{order_number}} has been delivered.\n\nAre you happy with our service?\n\nYou can unsubscribe from these requests by replying to this email.",
    buttonLabel: "Leave a review",
  },
  fr: {
    subject: "Votre colis a été livré",
    previewText: "Dites-nous comment cela s'est passé, en une minute.",
    heading: "Votre colis a été livré, {{first_name}}",
    body: "La commande {{order_number}} a été livrée.\n\nÊtes-vous satisfait de notre service ?\n\nVous pouvez vous désabonner de ces demandes en répondant à cet e-mail.",
    buttonLabel: "Laisser un avis",
  },
};

/**
 * Seed content for a trigger's step the very first time it's created -
 * matches the copy that trigger used before it became editable, so nothing
 * visibly changes until an admin opens the editor and changes something.
 * ORDER_PAID/ORDER_FULFILLED have no entry here: those steps were seeded by
 * the original migration and are never created by this backfill path (see
 * FALLBACK_STEP_IDS in lib/aftersales/service.ts for their fallback
 * content). Every OTHER trigger in AFTERSALES_TRIGGERS must have an entry:
 * a flow can only ever be saved once every one of its own flow-type's
 * triggers has an enabled step (see aftersalesFlowInputSchema), so any
 * trigger reachable through backfillAftersalesSteps without a preset here
 * would make that flow permanently unsavable from the admin UI.
 */
export const AFTERSALES_STEP_DEFAULTS: Partial<Record<AftersalesTriggerValue, { name: string; content: AftersalesLegacyStepContent }>> = {
  BACK_IN_STOCK: {
    name: "Voorraadmelding",
    content: { locales: backInStock, design: defaultAftersalesDesign },
  },
  REVIEW_REQUEST: {
    name: "Reviewverzoek",
    content: { locales: reviewRequest, design: defaultAftersalesDesign },
  },
  BUSINESS_ORDER_PAID: {
    name: "Zakelijke betaling ontvangen",
    content: { locales: businessOrderPaid, design: defaultAftersalesDesign },
  },
  BUSINESS_ORDER_FULFILLED: {
    name: "Zakelijke bestelling verzonden",
    content: { locales: businessOrderFulfilled, design: defaultAftersalesDesign },
  },
};
