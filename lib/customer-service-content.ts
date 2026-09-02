import type { Locale } from "@/lib/i18n";
import { pagePath } from "@/lib/pages";
import { account } from "@/lib/routes";
import { LEGAL_IDENTITY } from "@/lib/legal";
import {
  CUSTOMER_SERVICE_MARKET_VISITS,
  CUSTOMER_SERVICE_PHONE_DISPLAY,
  CUSTOMER_SERVICE_PHONE_E164,
  CUSTOMER_SERVICE_PHONE_HOURS,
  CUSTOMER_SERVICE_WHATSAPP_URL,
} from "@/lib/customer-service";
import {
  RETURN_WINDOW_DAYS,
  SHIPPING_POLICIES,
  STANDARD_HANDLING_DAYS,
  STANDARD_TRANSIT_DAYS,
} from "@/lib/shipping";

export type KnowledgeLink = { label: string; href: string };
export type KnowledgeEntry = {
  id: string;
  category: string;
  question: string;
  answer: string;
  links?: KnowledgeLink[];
};

export type CustomerServiceCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  metadataTitle: string;
  metadataDescription: string;
  scopeTitle: string;
  scopeText: string;
  knowledgeTitle: string;
  knowledgeLead: string;
  searchLabel: string;
  searchPlaceholder: string;
  clearSearch: string;
  resultCountSingular: string;
  resultCount: string;
  noResultsTitle: string;
  noResultsText: string;
  entries: KnowledgeEntry[];
  marketsEyebrow: string;
  marketsTitle: string;
  marketsLead: string;
  marketsLinkLabel: string;
  marketVisits: Array<{ id: string; day: string; location: string; hours: string }>;
  contactEyebrow: string;
  contactTitle: string;
  contactLead: string;
  postalAddressLabel: string;
  postalAddress: string;
  emailLabel: string;
  email: string;
  whatsappLabel: string;
  whatsappCta: string;
  whatsappUrl: string;
  phoneLabel: string;
  phoneDisplay: string;
  phoneHref: string;
  phoneHoursTitle: string;
  phoneHours: Array<{ day: string; hours: string }>;
  closedLabel: string;
  additionalTitle: string;
  additionalItems: string[];
};

export type AnnouncementTickerCopy = {
  ariaLabel: string;
  items: Array<{ id: string; text: string }>;
};

type AnnouncementUspCopy = {
  freshRoasted: string;
  personalAdvice: string;
  experience: string;
};

const weekdayNames: Record<Locale, readonly string[]> = {
  nl: ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  fr: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
};

function euro(locale: Locale, cents: number): string {
  const tag = locale === "nl" ? "nl-NL" : locale === "fr" ? "fr-FR" : "en-GB";
  return new Intl.NumberFormat(tag, { style: "currency", currency: "EUR" }).format(cents / 100);
}

function marketVisits(locale: Locale) {
  return CUSTOMER_SERVICE_MARKET_VISITS.map((visit) => ({
    id: visit.id,
    day: weekdayNames[locale][visit.weekday],
    location: visit.location,
    hours: `${visit.opensAt}–${visit.closesAt}`,
  }));
}

function phoneHours(locale: Locale) {
  const closed = locale === "nl" ? "Gesloten" : locale === "fr" ? "Fermé" : "Closed";
  return CUSTOMER_SERVICE_PHONE_HOURS.map((item) => ({
    day: weekdayNames[locale][item.weekday],
    hours: item.opensAt && item.closesAt ? `${item.opensAt}–${item.closesAt}` : closed,
  }));
}

export function getAnnouncementTickerCopy(
  locale: Locale,
  usp: AnnouncementUspCopy
): AnnouncementTickerCopy {
  const labels = {
    nl: "Voordelen van De Notenman",
    en: "Why shop at De Notenman",
    fr: "Les avantages de De Notenman",
  }[locale];
  const shippingLabel = {
    nl: `Gratis verzending: NL vanaf ${euro(locale, SHIPPING_POLICIES.NL.freeShippingThresholdCents)} · BE vanaf ${euro(locale, SHIPPING_POLICIES.BE.freeShippingThresholdCents)}`,
    en: `Free shipping: NL from ${euro(locale, SHIPPING_POLICIES.NL.freeShippingThresholdCents)} · BE from ${euro(locale, SHIPPING_POLICIES.BE.freeShippingThresholdCents)}`,
    fr: `Livraison gratuite : NL dès ${euro(locale, SHIPPING_POLICIES.NL.freeShippingThresholdCents)} · BE dès ${euro(locale, SHIPPING_POLICIES.BE.freeShippingThresholdCents)}`,
  }[locale];

  return {
    ariaLabel: labels,
    items: [
      { id: "fresh-roasted", text: usp.freshRoasted },
      { id: "personal-advice", text: usp.personalAdvice },
      { id: "market-experience", text: usp.experience },
      { id: "free-shipping", text: shippingLabel },
    ],
  };
}

export function getCustomerServiceCopy(locale: Locale): CustomerServiceCopy {
  const shippingMinimum = STANDARD_HANDLING_DAYS.min + STANDARD_TRANSIT_DAYS.min;
  const shippingMaximum = STANDARD_HANDLING_DAYS.max + STANDARD_TRANSIT_DAYS.max;
  const accountHref = account(locale);
  const shippingHref = pagePath("shippingReturns", locale);
  const marketsHref = pagePath("markets", locale);
  const productInformationHref = `/${locale}`;
  const termsHref = pagePath("terms", locale);
  const additionalTermsHref = pagePath("additionalTerms", locale);
  const privacyHref = pagePath("privacy", locale);
  const cookiesHref = pagePath("cookies", locale);
  const withdrawalHref = pagePath("withdrawal", locale);
  const processingAgreementHref = pagePath("processingAgreement", locale);
  const common = {
    postalAddress: `${LEGAL_IDENTITY.tradeName}, ${LEGAL_IDENTITY.address}`,
    email: LEGAL_IDENTITY.email,
    whatsappUrl: CUSTOMER_SERVICE_WHATSAPP_URL,
    phoneDisplay: CUSTOMER_SERVICE_PHONE_DISPLAY,
    phoneHref: `tel:${CUSTOMER_SERVICE_PHONE_E164}`,
    marketVisits: marketVisits(locale),
    phoneHours: phoneHours(locale),
  };

  if (locale === "en") {
    return {
      eyebrow: "Customer service",
      title: "How can we help?",
      lead: "Find practical answers about ordering, delivery, collection, returns and where to meet De Notenman.",
      metadataTitle: "Customer service and contact | De Notenman",
      metadataDescription: "Answers about ordering, shipping, returns and market collection, plus De Notenman contact details and opening hours.",
      scopeTitle: "Webshop knowledge only",
      scopeText: "This knowledge base only uses information published in the De Notenman webshop. It does not make assumptions about products, orders or policies.",
      knowledgeTitle: "Knowledge base",
      knowledgeLead: "Search the webshop information or open a question below.",
      searchLabel: "Search customer service",
      searchPlaceholder: "For example: delivery, returns or market",
      clearSearch: "Clear search",
      resultCountSingular: "1 answer found",
      resultCount: "{count} answers found",
      noResultsTitle: "No matching answer",
      noResultsText: "Try another search term or contact us using the details below.",
      entries: [
        { id: "order-status", category: "Orders", question: "How can I find my order status?", answer: "You do not need a login account. Open My account and enter the email address used for the order and your order number. A PostNL tracking link appears there when available.", links: [{ label: "Look up my order", href: accountHref }] },
        { id: "shipping", category: "Delivery", question: "Where do you deliver and what does it cost?", answer: `Delivery is available in the Netherlands and Belgium. Netherlands: ${euro(locale, SHIPPING_POLICIES.NL.rateTiers[0].rateCents)} up to 3 kg and ${euro(locale, SHIPPING_POLICIES.NL.rateTiers[1].rateCents)} above 3 kg, free from ${euro(locale, SHIPPING_POLICIES.NL.freeShippingThresholdCents)}. Belgium: ${euro(locale, SHIPPING_POLICIES.BE.rateTiers[0].rateCents)} up to 2 kg and ${euro(locale, SHIPPING_POLICIES.BE.rateTiers[1].rateCents)} above 2 kg, free from ${euro(locale, SHIPPING_POLICIES.BE.freeShippingThresholdCents)}. Processing and delivery usually take about ${shippingMinimum}–${shippingMaximum} business days.`, links: [{ label: "Shipping and returns policy", href: shippingHref }] },
        { id: "collection", category: "Market collection", question: "Can I collect my order at the market?", answer: "Yes. During checkout, choose one of the available market locations and market days. Your order confirmation shows the selected collection option.", links: [{ label: "View the weekly market route", href: marketsHref }] },
        { id: "returns", category: "Returns", question: "How do returns work?", answer: `For eligible products, consumers have a ${RETURN_WINDOW_DAYS}-day withdrawal period after receipt. Notify De Notenman first by email and follow the current return instructions. Food safety and hygiene exceptions may apply.`, links: [{ label: "Read the complete returns policy", href: shippingHref }] },
        { id: "change-order", category: "Orders", question: "Can I change or cancel an order?", answer: "Contact De Notenman immediately before dispatch if you want to cancel or correct an address. We will try to make the change, but cannot guarantee this after processing or carrier handover." },
        { id: "product-information", category: "Products", question: "Where can I find ingredients and allergen information?", answer: "Open the relevant product page. Available ingredients, allergens, nutritional values and storage information are shown in the product details.", links: [{ label: "Browse the product range", href: productInformationHref }] },
        { id: "market-days", category: "Markets", question: "Where can I find De Notenman at the market?", answer: "Thursday in Hilvarenbeek from 08:00–12:00, Friday in Uden from 08:00–12:30 and Saturday in Antwerp from 08:00–16:00.", links: [{ label: "Find DeNotenman", href: marketsHref }] },
        { id: "terms", category: "Terms & policies", question: "Where can I find the terms and conditions?", answer: "De Notenman's terms and conditions describe the rules around ordering, payment, delivery and warranty. They're also linked at the bottom of every page.", links: [{ label: "Read the terms and conditions", href: termsHref }] },
        { id: "additional-terms", category: "Terms & policies", question: "What do the additional terms cover?", answer: "Alongside the general terms and conditions, additional terms apply to specific situations, such as promotions or deliveries to business customers.", links: [{ label: "Read the additional terms", href: additionalTermsHref }] },
        { id: "privacy", category: "Terms & policies", question: "How does De Notenman handle my personal data?", answer: "Our privacy policy explains what data we collect, what we use it for, how long we keep it, and how to exercise your rights (such as access or deletion).", links: [{ label: "Read the privacy policy", href: privacyHref }] },
        { id: "cookies", category: "Terms & policies", question: "Which cookies does the webshop use?", answer: "We use functional cookies and, with your consent, analytics and marketing cookies. The cookie policy explains exactly which cookies these are and what they're for.", links: [{ label: "Read the cookie policy", href: cookiesHref }] },
        { id: "cookie-settings", category: "Terms & policies", question: "How do I change my cookie settings?", answer: "At the bottom of every page, the footer has a 'Cookie settings' button. Use it to review or change your consent at any time.", links: [{ label: "Read the cookie policy", href: cookiesHref }] },
        { id: "withdrawal", category: "Terms & policies", question: "Can I withdraw my order?", answer: "As a consumer you have a statutory right of withdrawal on most products, with exceptions for perishable goods or products sealed for hygiene reasons. See the full conditions and how to notify us.", links: [{ label: "Read the right of withdrawal", href: withdrawalHref }] },
        { id: "processing-agreement", category: "Terms & policies", question: "Do you offer a data processing agreement for business customers?", answer: "Business customers who have De Notenman process personal data on their behalf can review or request our data processing agreement.", links: [{ label: "Read the data processing agreement", href: processingAgreementHref }] },
      ],
      marketsEyebrow: "Market route",
      marketsTitle: "Visit De Notenman",
      marketsLead: "These are our fixed market days and times.",
      marketsLinkLabel: "Find DeNotenman at the market",
      contactEyebrow: "Contact",
      contactTitle: "Prefer personal contact?",
      contactLead: "Use email, WhatsApp or call us during telephone opening hours.",
      postalAddressLabel: "Postal address",
      emailLabel: "Email",
      whatsappLabel: "WhatsApp",
      whatsappCta: "Send a WhatsApp message",
      phoneLabel: "Telephone",
      phoneHoursTitle: "Telephone availability",
      closedLabel: "Closed",
      additionalTitle: "Good to know",
      additionalItems: ["We can only answer telephone calls during the hours shown above.", "You can send a WhatsApp message at any time of day."],
      ...common,
    };
  }

  if (locale === "fr") {
    return {
      eyebrow: "Service client",
      title: "Comment pouvons-nous vous aider ?",
      lead: "Trouvez des réponses pratiques sur les commandes, la livraison, le retrait, les retours et les marchés de De Notenman.",
      metadataTitle: "Service client et contact | De Notenman",
      metadataDescription: "Réponses sur les commandes, la livraison, les retours et le retrait au marché, avec les coordonnées et horaires de De Notenman.",
      scopeTitle: "Uniquement les informations de la boutique",
      scopeText: "Cette base de connaissances utilise uniquement les informations publiées dans la boutique De Notenman. Elle ne fait aucune supposition sur les produits, les commandes ou les conditions.",
      knowledgeTitle: "Base de connaissances",
      knowledgeLead: "Recherchez dans les informations de la boutique ou ouvrez une question ci-dessous.",
      searchLabel: "Rechercher dans le service client",
      searchPlaceholder: "Par exemple : livraison, retour ou marché",
      clearSearch: "Effacer la recherche",
      resultCountSingular: "1 réponse trouvée",
      resultCount: "{count} réponses trouvées",
      noResultsTitle: "Aucune réponse correspondante",
      noResultsText: "Essayez un autre terme ou contactez-nous avec les coordonnées ci-dessous.",
      entries: [
        { id: "order-status", category: "Commandes", question: "Comment consulter le statut de ma commande ?", answer: "Vous n’avez pas besoin d’un compte de connexion. Ouvrez Mon compte et saisissez l’adresse e-mail de la commande ainsi que votre numéro de commande. Un lien de suivi PostNL y apparaît lorsqu’il est disponible.", links: [{ label: "Retrouver ma commande", href: accountHref }] },
        { id: "shipping", category: "Livraison", question: "Où livrez-vous et quel est le tarif ?", answer: `La livraison est disponible aux Pays-Bas et en Belgique. Pays-Bas : ${euro(locale, SHIPPING_POLICIES.NL.rateTiers[0].rateCents)} jusqu’à 3 kg et ${euro(locale, SHIPPING_POLICIES.NL.rateTiers[1].rateCents)} au-delà, gratuite dès ${euro(locale, SHIPPING_POLICIES.NL.freeShippingThresholdCents)}. Belgique : ${euro(locale, SHIPPING_POLICIES.BE.rateTiers[0].rateCents)} jusqu’à 2 kg et ${euro(locale, SHIPPING_POLICIES.BE.rateTiers[1].rateCents)} au-delà, gratuite dès ${euro(locale, SHIPPING_POLICIES.BE.freeShippingThresholdCents)}. Le traitement et la livraison prennent généralement environ ${shippingMinimum}–${shippingMaximum} jours ouvrés.`, links: [{ label: "Politique de livraison et de retour", href: shippingHref }] },
        { id: "collection", category: "Retrait au marché", question: "Puis-je retirer ma commande au marché ?", answer: "Oui. Pendant le paiement, choisissez l’un des lieux et jours de marché proposés. La confirmation de commande indique l’option de retrait choisie.", links: [{ label: "Voir l’itinéraire hebdomadaire", href: marketsHref }] },
        { id: "returns", category: "Retours", question: "Comment fonctionnent les retours ?", answer: `Pour les produits éligibles, le consommateur dispose d’un délai de rétractation de ${RETURN_WINDOW_DAYS} jours après réception. Prévenez d’abord De Notenman par e-mail et suivez les instructions de retour actuelles. Des exceptions liées à l’hygiène et à la sécurité alimentaire peuvent s’appliquer.`, links: [{ label: "Lire la politique complète", href: shippingHref }] },
        { id: "change-order", category: "Commandes", question: "Puis-je modifier ou annuler une commande ?", answer: "Contactez immédiatement De Notenman avant l’expédition pour annuler ou corriger une adresse. Nous essaierons d’effectuer la modification, sans pouvoir la garantir après le traitement ou la remise au transporteur." },
        { id: "product-information", category: "Produits", question: "Où trouver les ingrédients et les allergènes ?", answer: "Ouvrez la page du produit concerné. Les ingrédients, allergènes, valeurs nutritionnelles et informations de conservation disponibles figurent dans les détails du produit.", links: [{ label: "Voir les produits", href: productInformationHref }] },
        { id: "market-days", category: "Marchés", question: "Où retrouver De Notenman au marché ?", answer: "Jeudi à Hilvarenbeek de 08:00 à 12:00, vendredi à Uden de 08:00 à 12:30 et samedi à Anvers de 08:00 à 16:00.", links: [{ label: "Trouver DeNotenman", href: marketsHref }] },
        { id: "terms", category: "Conditions et politiques", question: "Où puis-je trouver les conditions générales ?", answer: "Les conditions générales de De Notenman décrivent les règles de commande, de paiement, de livraison et de garantie. Elles sont également accessibles en bas de chaque page.", links: [{ label: "Lire les conditions générales", href: termsHref }] },
        { id: "additional-terms", category: "Conditions et politiques", question: "Que contiennent les conditions complémentaires ?", answer: "Outre les conditions générales, des conditions complémentaires s'appliquent à des situations spécifiques, comme les promotions ou les livraisons aux clients professionnels.", links: [{ label: "Lire les conditions complémentaires", href: additionalTermsHref }] },
        { id: "privacy", category: "Conditions et politiques", question: "Comment De Notenman traite-t-il mes données personnelles ?", answer: "Notre politique de confidentialité explique quelles données nous collectons, à quelles fins, combien de temps nous les conservons et comment exercer vos droits (accès, suppression, etc.).", links: [{ label: "Lire la politique de confidentialité", href: privacyHref }] },
        { id: "cookies", category: "Conditions et politiques", question: "Quels cookies la boutique utilise-t-elle ?", answer: "Nous utilisons des cookies fonctionnels et, avec votre consentement, des cookies analytiques et marketing. La politique de cookies détaille précisément lesquels et à quoi ils servent.", links: [{ label: "Lire la politique de cookies", href: cookiesHref }] },
        { id: "cookie-settings", category: "Conditions et politiques", question: "Comment modifier mes préférences de cookies ?", answer: "En bas de chaque page, le pied de page propose un bouton « Paramètres des cookies ». Il permet de consulter ou modifier votre consentement à tout moment.", links: [{ label: "Lire la politique de cookies", href: cookiesHref }] },
        { id: "withdrawal", category: "Conditions et politiques", question: "Puis-je me rétracter de ma commande ?", answer: "En tant que consommateur, vous disposez d'un droit de rétractation légal sur la plupart des produits, avec des exceptions pour les denrées périssables ou les produits scellés pour des raisons d'hygiène. Consultez les conditions complètes et la marche à suivre.", links: [{ label: "Lire le droit de rétractation", href: withdrawalHref }] },
        { id: "processing-agreement", category: "Conditions et politiques", question: "Proposez-vous un accord de traitement des données pour les clients professionnels ?", answer: "Les clients professionnels qui font traiter des données personnelles par De Notenman peuvent consulter ou demander notre accord de traitement des données.", links: [{ label: "Lire l'accord de traitement des données", href: processingAgreementHref }] },
      ],
      marketsEyebrow: "Itinéraire des marchés",
      marketsTitle: "Retrouvez De Notenman",
      marketsLead: "Voici nos jours et horaires fixes de marché.",
      marketsLinkLabel: "Trouver DeNotenman au marché",
      contactEyebrow: "Contact",
      contactTitle: "Vous préférez un contact personnel ?",
      contactLead: "Écrivez-nous par e-mail ou WhatsApp, ou appelez pendant les heures de disponibilité téléphonique.",
      postalAddressLabel: "Adresse postale",
      emailLabel: "E-mail",
      whatsappLabel: "WhatsApp",
      whatsappCta: "Envoyer un message WhatsApp",
      phoneLabel: "Téléphone",
      phoneHoursTitle: "Disponibilité téléphonique",
      closedLabel: "Fermé",
      additionalTitle: "Bon à savoir",
      additionalItems: ["Nous sommes joignables par téléphone uniquement pendant les horaires indiqués ci-dessus.", "Vous pouvez envoyer un message WhatsApp à tout moment de la journée."],
      ...common,
    };
  }

  return {
    eyebrow: "Klantenservice",
    title: "Waar kunnen we je mee helpen?",
    lead: "Vind praktische antwoorden over bestellen, bezorgen, afhalen, retourneren en waar je De Notenman op de markt vindt.",
    metadataTitle: "Klantenservice en contact | De Notenman",
    metadataDescription: "Antwoorden over bestellen, bezorgen, retourneren en afhalen op de markt, met contactgegevens en bereikbaarheid van De Notenman.",
    scopeTitle: "Alleen kennis uit onze webshop",
    scopeText: "Deze kennisbank gebruikt uitsluitend informatie die op de webshop van De Notenman staat. We doen geen aannames over producten, bestellingen of voorwaarden.",
    knowledgeTitle: "Kennisbank",
    knowledgeLead: "Doorzoek de webshopinformatie of open hieronder een vraag.",
    searchLabel: "Zoeken in klantenservice",
    searchPlaceholder: "Bijvoorbeeld: bezorgen, retour of markt",
    clearSearch: "Zoekopdracht wissen",
    resultCountSingular: "1 antwoord gevonden",
    resultCount: "{count} antwoorden gevonden",
    noResultsTitle: "Geen passend antwoord gevonden",
    noResultsText: "Probeer een andere zoekterm of neem contact op via de gegevens onderaan deze pagina.",
    entries: [
      { id: "order-status", category: "Bestellingen", question: "Waar vind ik de status van mijn bestelling?", answer: "Je hebt geen inlogaccount nodig. Open Mijn account en vul het e-mailadres van de bestelling en je bestelnummer in. Als er een PostNL-code beschikbaar is, staat daar de track-en-tracelink.", links: [{ label: "Mijn bestelling opzoeken", href: accountHref }] },
      { id: "shipping", category: "Bezorgen", question: "Waar bezorgen jullie en wat kost het?", answer: `Bezorging is beschikbaar in Nederland en België. Nederland: ${euro(locale, SHIPPING_POLICIES.NL.rateTiers[0].rateCents)} t/m 3 kg en ${euro(locale, SHIPPING_POLICIES.NL.rateTiers[1].rateCents)} daarboven, gratis vanaf ${euro(locale, SHIPPING_POLICIES.NL.freeShippingThresholdCents)}. België: ${euro(locale, SHIPPING_POLICIES.BE.rateTiers[0].rateCents)} t/m 2 kg en ${euro(locale, SHIPPING_POLICIES.BE.rateTiers[1].rateCents)} daarboven, gratis vanaf ${euro(locale, SHIPPING_POLICIES.BE.freeShippingThresholdCents)}. Verwerking en bezorging duren gewoonlijk samen ongeveer ${shippingMinimum}–${shippingMaximum} werkdagen.`, links: [{ label: "Bekijk het verzend- en retourbeleid", href: shippingHref }] },
      { id: "collection", category: "Afhalen", question: "Kan ik mijn bestelling op de markt afhalen?", answer: "Ja. Kies tijdens het afrekenen een aangeboden marktlocatie en marktdag. In je bestelbevestiging staat welke afhaalmogelijkheid je hebt gekozen.", links: [{ label: "Bekijk de vaste weekroute", href: marketsHref }] },
      { id: "returns", category: "Retourneren", question: "Hoe werkt retourneren?", answer: `Voor producten waarop geen uitzondering geldt, heeft een consument na ontvangst ${RETURN_WINDOW_DAYS} dagen bedenktijd. Meld je retour eerst per e-mail aan en volg de actuele retourinstructies. Voor voedselveiligheid en hygiëne kunnen uitzonderingen gelden.`, links: [{ label: "Lees het volledige retourbeleid", href: shippingHref }] },
      { id: "change-order", category: "Bestellingen", question: "Kan ik mijn bestelling wijzigen of annuleren?", answer: "Neem vóór verzending direct contact op als je wilt annuleren of een adres wilt corrigeren. De Notenman probeert de wijziging uit te voeren, maar kan dit na verwerking of overdracht aan de vervoerder niet garanderen." },
      { id: "product-information", category: "Producten", question: "Waar vind ik ingrediënten en allergenen?", answer: "Open de betreffende productpagina. Beschikbare ingrediënten, allergenen, voedingswaarden en bewaarinformatie staan bij de productdetails.", links: [{ label: "Bekijk het assortiment", href: productInformationHref }] },
      { id: "market-days", category: "Markten", question: "Waar staat De Notenman op de markt?", answer: "Donderdag in Hilvarenbeek van 08:00–12:00, vrijdag in Uden van 08:00–12:30 en zaterdag in Antwerpen van 08:00–16:00.", links: [{ label: "Vind DeNotenman", href: marketsHref }] },
      { id: "terms", category: "Voorwaarden & beleid", question: "Waar vind ik de algemene voorwaarden?", answer: "De algemene voorwaarden van De Notenman beschrijven de regels rond bestellen, betalen, leveren en garantie. Ze staan ook onderaan iedere pagina in de footer.", links: [{ label: "Lees de algemene voorwaarden", href: termsHref }] },
      { id: "additional-terms", category: "Voorwaarden & beleid", question: "Wat staat er in de aanvullende voorwaarden?", answer: "Naast de algemene voorwaarden gelden aanvullende voorwaarden voor specifieke situaties, zoals acties of leveringen aan zakelijke klanten.", links: [{ label: "Lees de aanvullende voorwaarden", href: additionalTermsHref }] },
      { id: "privacy", category: "Voorwaarden & beleid", question: "Hoe gaat De Notenman om met mijn persoonsgegevens?", answer: "In ons privacybeleid lees je welke gegevens we verzamelen, waarvoor we die gebruiken, hoe lang we ze bewaren en hoe je je rechten (zoals inzage of verwijdering) kunt uitoefenen.", links: [{ label: "Lees het privacybeleid", href: privacyHref }] },
      { id: "cookies", category: "Voorwaarden & beleid", question: "Welke cookies gebruikt de webshop?", answer: "We gebruiken functionele cookies en, met jouw toestemming, analytische en marketingcookies. In het cookiebeleid lees je precies welke cookies dat zijn en waarvoor ze dienen.", links: [{ label: "Lees het cookiebeleid", href: cookiesHref }] },
      { id: "cookie-settings", category: "Voorwaarden & beleid", question: "Hoe pas ik mijn cookie-instellingen aan?", answer: "Onderaan iedere pagina vind je in de footer de knop 'Cookie-instellingen'. Daarmee bekijk je op elk moment welke toestemming je hebt gegeven en kun je deze wijzigen.", links: [{ label: "Lees het cookiebeleid", href: cookiesHref }] },
      { id: "withdrawal", category: "Voorwaarden & beleid", question: "Kan ik mijn bestelling herroepen?", answer: "Als consument heb je binnen de wettelijke bedenktijd herroepingsrecht op de meeste producten, met uitzonderingen voor bederfelijke of om hygiënische redenen verzegelde producten. Bekijk de volledige voorwaarden en hoe je een herroeping meldt.", links: [{ label: "Lees het herroepingsrecht", href: withdrawalHref }] },
      { id: "processing-agreement", category: "Voorwaarden & beleid", question: "Bieden jullie een verwerkersovereenkomst aan voor zakelijke klanten?", answer: "Zakelijke klanten die persoonsgegevens door De Notenman laten verwerken, kunnen de verwerkersovereenkomst raadplegen of bij ons opvragen.", links: [{ label: "Lees de verwerkersovereenkomst", href: processingAgreementHref }] },
    ],
    marketsEyebrow: "Marktroute",
    marketsTitle: "Bezoek De Notenman",
    marketsLead: "Dit zijn onze vaste marktdagen en tijden.",
    marketsLinkLabel: "Vind DeNotenman op de markt",
    contactEyebrow: "Contact",
    contactTitle: "Liever persoonlijk contact?",
    contactLead: "Mail ons, stuur een WhatsApp-bericht of bel tijdens onze telefonische bereikbaarheid.",
    postalAddressLabel: "Postadres",
    emailLabel: "E-mailadres",
    whatsappLabel: "WhatsApp",
    whatsappCta: "Stuur een WhatsApp-bericht",
    phoneLabel: "Telefonisch contact",
    phoneHoursTitle: "Telefonische bereikbaarheid",
    closedLabel: "Gesloten",
    additionalTitle: "Aanvullende informatie",
    additionalItems: ["Telefonisch zijn wij alleen bereikbaar tijdens de bovenstaande openingstijden.", "Via WhatsApp kun je op ieder moment van de dag een bericht sturen."],
    ...common,
  };
}
