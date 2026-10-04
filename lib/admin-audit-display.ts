import { formatAmsterdamDateTime } from "@/lib/amsterdam-calendar";

export type AuditDisplayAction = "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | string;

export type AuditDisplayEntry = {
  action: AuditDisplayAction;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
};

export type AuditDisplayChange = {
  key: string;
  label: string;
  before: string;
  after: string;
};

const ENTITY_LABELS: Record<string, string> = {
  Product: "Product",
  ProductVariant: "Productvariant",
  Category: "Categorie",
  QrCodeDesign: "QR-code",
  Discount: "Kortingscode",
  MarketingBanner: "Marketingbanner",
  MarketingCampaign: "Marketingcampagne",
  NewsletterCampaign: "Nieuwsbrief",
  BusinessAccount: "Zakelijke klant",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Aangemaakt",
  UPDATE: "Gewijzigd",
  DELETE: "Verwijderd",
  RESTORE: "Hersteld",
};

const ACTION_VERBS: Record<string, string> = {
  CREATE: "aangemaakt",
  UPDATE: "bijgewerkt",
  DELETE: "verwijderd",
  RESTORE: "hersteld",
};

const FIELD_LABELS: Record<string, string> = {
  companyName: "Bedrijfsnaam",
  contactName: "Contactpersoon",
  customerNumber: "Klantnummer",
  email: "E-mailadres",
  phone: "Telefoonnummer",
  status: "Status",
  notes: "Interne notities",
  country: "Land",
  vatNumber: "BTW-nummer",
  kvkNumber: "KVK-nummer",
  vatRegime: "BTW-regeling",
  vatRatePercent: "BTW-percentage",
  peppolConfigured: "Peppol ingesteld",
  peppolParticipantId: "Peppol-deelnemernummer",
  fixedPickupLocationId: "Vaste afhaallocatie",
  pickupFrequency: "Afhaalfrequentie",
  shippingEnabled: "Bezorgen toegestaan",
  businessNewsletterOptIn: "Zakelijke nieuwsbrief",
  billingStreet: "Factuurstraat",
  billingHouseNumber: "Factuurhuisnummer",
  billingPostalCode: "Factuurpostcode",
  billingCity: "Factuurplaats",
  billingCountry: "Factuurland",
  shippingStreet: "Bezorgstraat",
  shippingHouseNumber: "Bezorghuisnummer",
  shippingPostalCode: "Bezorgpostcode",
  shippingCity: "Bezorgplaats",
  shippingCountry: "Bezorgland",
  deletedAt: "Verwijderd op",
  name: "Naam",
  title: "Titel",
  code: "Code",
  isActive: "Actief",
  priceCents: "Prijs",
  stock: "Voorraad",
};

const VALUE_LABELS: Record<string, string> = {
  PENDING: "In afwachting",
  APPROVED: "Goedgekeurd",
  REJECTED: "Afgewezen",
  SUSPENDED: "Geschorst",
  STANDARD: "Standaard BTW",
  REVERSE_CHARGE: "BTW verlegd",
  WEEKLY: "Wekelijks",
  BIWEEKLY: "Om de week",
  MONTHLY: "Maandelijks",
  ON_REQUEST: "Op aanvraag",
  NL: "Nederland",
  BE: "België",
};

const TECHNICAL_FIELDS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "shadowUserId",
  "loginLinkRequestedAt",
  "businessNewsletterConsentAt",
]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sensitiveField(key: string): boolean {
  return /(password|secret|token|hash|encrypted|apiKey|labelBase64)/iu.test(key);
}

export function redactAuditTechnicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditTechnicalValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      sensitiveField(key) ? "[AFGESCHERMD]" : redactAuditTechnicalValue(nestedValue),
    ]),
  );
}

function comparable(value: unknown): string {
  if (value === undefined) return "__undefined__";
  return JSON.stringify(value);
}

function formatDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/u.test(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatAmsterdamDateTime(date, "nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function auditEntityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? "Onderdeel";
}

export function auditActionLabel(action: AuditDisplayAction): string {
  return ACTION_LABELS[action] ?? "Gewijzigd";
}

export function auditFieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/([a-z])([A-Z])/gu, "$1 $2").toLocaleLowerCase("nl-NL");
}

export function formatAuditValue(key: string, value: unknown): string {
  if (sensitiveField(key)) return "Afgeschermd";
  if (value === null || value === undefined || value === "") return "Niet ingevuld";
  if (typeof value === "boolean") return value ? "Ja" : "Nee";
  if (typeof value === "number") {
    if (key.endsWith("Cents")) {
      return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(value / 100);
    }
    return new Intl.NumberFormat("nl-NL").format(value);
  }
  if (typeof value === "string") return VALUE_LABELS[value] ?? formatDate(value) ?? value;
  if (Array.isArray(value)) return `${value.length} ${value.length === 1 ? "item" : "items"}`;
  return "Meerdere gegevens";
}

export function getAuditChanges(before: unknown, after: unknown): AuditDisplayChange[] {
  const beforeRecord = record(before);
  const afterRecord = record(after);
  const keys = Array.from(new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])).sort();

  return keys
    .filter((key) => !TECHNICAL_FIELDS.has(key) && !sensitiveField(key))
    .filter((key) => comparable(beforeRecord[key]) !== comparable(afterRecord[key]))
    .map((key) => ({
      key,
      label: auditFieldLabel(key),
      before: formatAuditValue(key, beforeRecord[key]),
      after: formatAuditValue(key, afterRecord[key]),
    }));
}

function subject(entry: AuditDisplayEntry): string | null {
  const preferred = entry.action === "DELETE" ? record(entry.before) : record(entry.after);
  const fallback = entry.action === "DELETE" ? record(entry.after) : record(entry.before);
  const source = Object.keys(preferred).length > 0 ? preferred : fallback;
  const name = ["companyName", "name", "title", "code", "email", "orderNumber", "invoiceNumber"]
    .map((key) => source[key])
    .find((value) => typeof value === "string" && value.trim().length > 0);
  const customerNumber = typeof source.customerNumber === "string" && source.customerNumber.trim()
    ? source.customerNumber.trim()
    : null;

  if (typeof name === "string") return customerNumber ? `${name} (${customerNumber})` : name;
  return customerNumber;
}

export function auditSummary(entry: AuditDisplayEntry): string {
  const label = auditEntityLabel(entry.entityType);
  const name = subject(entry);
  const verb = ACTION_VERBS[entry.action] ?? "bijgewerkt";
  return `${label}${name ? ` ${name}` : ""} ${verb}.`;
}
