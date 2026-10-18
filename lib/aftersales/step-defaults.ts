import {
  defaultAftersalesDesign,
  type AftersalesCanvas,
  type AftersalesLegacyLocaleContent,
  type AftersalesLegacyStepContent,
  type AftersalesStepContent,
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

// Variant D of the approved design. The Dutch question and button label are
// fixed verbatim by that design and are not ours to reword; the opt-out is
// reply-based because this mail has no unsubscribe-link infrastructure, and a
// line pointing at a link that does not exist would be worse than none.
const reviewRequest: Record<"nl" | "en" | "fr", AftersalesLegacyLocaleContent> = {
  nl: {
    subject: "Je pakket is bezorgd",
    previewText: "Laat in een minuut weten hoe het ging.",
    heading: "Je pakket is bezorgd, {{first_name}}",
    body: "Bestelling {{order_number}} is afgeleverd.",
    buttonLabel: "Laat een review achter",
  },
  en: {
    subject: "Your parcel has been delivered",
    previewText: "Tell us how it went; it takes a minute.",
    heading: "Your parcel has been delivered, {{first_name}}",
    body: "Order {{order_number}} has been delivered.",
    buttonLabel: "Leave a review",
  },
  fr: {
    subject: "Votre colis a été livré",
    previewText: "Dites-nous comment cela s'est passé, en une minute.",
    heading: "Votre colis a été livré, {{first_name}}",
    body: "La commande {{order_number}} a été livrée.",
    buttonLabel: "Laisser un avis",
  },
};

const reviewRequestOptOut: Record<"nl" | "en" | "fr", string> = {
  nl: "Je kunt je voor deze verzoeken afmelden door op deze mail te antwoorden.",
  en: "You can unsubscribe from these requests by replying to this email.",
  fr: "Vous pouvez vous désabonner de ces demandes en répondant à cet e-mail.",
};

/**
 * The approved block, exactly as the client supplied it: the Google wordmark in
 * Google's own letter colours, five gold stars, the question, and the blue
 * button. Both the stars and the button point at `{{order_url}}`, which the
 * renderer fills with the configured Google review form — one destination for
 * every rating, which is what keeps this clear of review gating.
 *
 * Google does not accept a pre-filled rating, so the stars are an affordance,
 * not a score: whichever one a customer clicks, the form opens empty.
 */
function googleReviewBlockHtml(input: {
  reviewsLabel: string;
  question: string;
  buttonLabel: string;
}): string {
  return [
    '<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; background-color: #f9f9f9; border-radius: 8px; border: 1px solid #e8e8e8; padding: 20px; text-align: center; width: 100%; max-width: 400px; margin: 0 auto;">',
    "<tr><td>",
    '<span style="font-size: 24px; font-weight: bold; color: #4285F4;">G<span style="color: #EA4335;">o</span><span style="color: #FBBC05;">o</span><span style="color: #4285F4;">g</span><span style="color: #34A853;">l</span><span style="color: #EA4335;">e</span></span>',
    `<p style="margin: 5px 0 10px 0; font-size: 14px; color: #5f6368; font-weight: bold;">${input.reviewsLabel}</p>`,
    "</td></tr>",
    "<tr><td>",
    '<a href="{{order_url}}" style="color: #fbbc05; font-size: 32px; letter-spacing: 2px; text-decoration: none;">&#9733;&#9733;&#9733;&#9733;&#9733;</a>',
    "</td></tr>",
    "<tr><td>",
    `<p style="margin: 15px 0 5px 0; font-size: 15px; color: #3c4043;">${input.question}</p>`,
    `<a href="{{order_url}}" style="display: inline-block; background-color: #1a73e8; color: #ffffff; text-decoration: none; padding: 10px 20px; font-weight: bold; border-radius: 4px; margin-top: 10px; font-size: 14px;">${input.buttonLabel}</a>`,
    "</td></tr>",
    "</table>",
  ].join("");
}

const reviewRequestBlock: Record<"nl" | "en" | "fr", string> = {
  nl: googleReviewBlockHtml({
    reviewsLabel: "Beoordelingen",
    question: "Bent u tevreden over onze service?",
    buttonLabel: "Laat een review achter",
  }),
  en: googleReviewBlockHtml({
    reviewsLabel: "Reviews",
    question: "Are you happy with our service?",
    buttonLabel: "Leave a review",
  }),
  fr: googleReviewBlockHtml({
    reviewsLabel: "Avis",
    question: "Êtes-vous satisfait de notre service ?",
    buttonLabel: "Laisser un avis",
  }),
};

/**
 * The review step's content with an explicit canvas, so the approved block
 * ships as-is instead of being flattened into the generic heading/body/button
 * layout that `resolveLegacyStepContent` derives. The opt-out sits in its own
 * block below the Google block, where the design puts it.
 */
export function reviewRequestStepContent(): AftersalesStepContent {
  const canvas: AftersalesCanvas = {
    rows: [
      {
        id: "review-row",
        backgroundColor: "#ffffff",
        padding: 0,
        columns: [
          {
            id: "review-main",
            widthFraction: 1,
            backgroundColor: "#ffffff",
            padding: 0,
            blocks: [
              { id: "heading", type: "text", font: "SANS", size: "GROOT", color: "#141414", align: "left", bold: true, italic: false },
              { id: "body", type: "text", font: "SANS", size: "STANDAARD", color: "#333333", align: "left", bold: false, italic: false },
              { id: "google", type: "customHtml" },
              { id: "optout", type: "text", font: "SANS", size: "COMPACT", color: "#625c53", align: "left", bold: false, italic: false },
            ],
          },
        ],
      },
    ],
  };

  const withBlockText = (locale: "nl" | "en" | "fr") => ({
    ...reviewRequest[locale],
    blockText: {
      heading: reviewRequest[locale].heading,
      body: reviewRequest[locale].body,
      google: reviewRequestBlock[locale],
      optout: reviewRequestOptOut[locale],
    },
  });

  return {
    locales: { nl: withBlockText("nl"), en: withBlockText("en"), fr: withBlockText("fr") },
    design: defaultAftersalesDesign,
    canvas,
  };
}

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
export const AFTERSALES_STEP_DEFAULTS: Partial<
  Record<
    AftersalesTriggerValue,
    {
      name: string;
      content: AftersalesLegacyStepContent;
      /**
       * Set when the step ships with a hand-built canvas instead of the one
       * `resolveLegacyStepContent` derives from heading/body/button. The review
       * step needs this: its approved design is a block the generic layout
       * cannot express.
       */
      resolved?: AftersalesStepContent;
    }
  >
> = {
  BACK_IN_STOCK: {
    name: "Voorraadmelding",
    content: { locales: backInStock, design: defaultAftersalesDesign },
  },
  REVIEW_REQUEST: {
    name: "Reviewverzoek",
    content: { locales: reviewRequest, design: defaultAftersalesDesign },
    resolved: reviewRequestStepContent(),
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
