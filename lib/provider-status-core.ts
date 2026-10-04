import type { PhotoRoomAvailability } from "@/lib/design-studio/types";

export type ProviderStatusState = "ready" | "attention" | "missing" | "blocked" | "unavailable";

export type ProviderStatus = {
  id: "mollie" | "postnl" | "mailchimp" | "ga4" | "storage" | "gemini" | "photoroom" | "social";
  label: string;
  state: ProviderStatusState;
  statusLabel: string;
  summary: string;
  details: string[];
  evidence: "configuration" | "database" | "provider";
};

export type IntegrationHealth = ProviderStatus & {
  configured: boolean;
  status: ProviderStatusState;
  lastCheckedAt: string;
  error: { code: string; message: string } | null;
};

export type SocialStatusAccount = {
  platform: "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE";
  status: string;
};

export type ProviderStatusInput = {
  environment: Record<string, string | undefined>;
  settings: Record<string, string | null>;
  photoRoom: PhotoRoomAvailability;
  socialAccounts: SocialStatusAccount[] | null;
};

const STATUS_LABELS: Record<ProviderStatusState, string> = {
  ready: "Klaar",
  attention: "Aandacht nodig",
  missing: "Niet ingesteld",
  blocked: "Geblokkeerd",
  unavailable: "Niet controleerbaar",
};

function present(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function status(
  value: Omit<ProviderStatus, "statusLabel">,
): ProviderStatus {
  return { ...value, statusLabel: STATUS_LABELS[value.state] };
}

function configuredCount(environment: Record<string, string | undefined>, keys: string[]): number {
  return keys.filter((key) => present(environment[key])).length;
}

function mollieStatus(environment: Record<string, string | undefined>): ProviderStatus {
  const key = environment.MOLLIE_API_KEY?.trim() ?? "";
  if (!key) {
    return status({ id: "mollie", label: "Mollie", state: "missing", summary: "Geen API-sleutel ingesteld.", details: ["Er is geen providercontrole uitgevoerd."], evidence: "configuration" });
  }
  const live = key.startsWith("live_");
  const test = key.startsWith("test_");
  return status({
    id: "mollie",
    label: "Mollie",
    state: live ? "ready" : "attention",
    summary: live ? "Productiesleutel aanwezig." : test ? "Alleen een testsleutel aanwezig." : "Sleutel aanwezig, maar de modus is niet herkenbaar.",
    details: ["De sleutel zelf wordt niet getoond.", "Geen betaling of providerverzoek uitgevoerd."],
    evidence: "configuration",
  });
}

function postnlStatus(environment: Record<string, string | undefined>, settings: Record<string, string | null>): ProviderStatus {
  const accountKeys = ["postnl.customerCode", "postnl.customerNumber", "postnl.collectionLocation"];
  const senderKeys = ["postnl.senderName", "postnl.senderStreet", "postnl.senderHouseNumber", "postnl.senderPostalCode", "postnl.senderCity"];
  const api = present(environment.POSTNL_API_KEY);
  const account = accountKeys.every((key) => present(settings[key]));
  const sender = senderKeys.every((key) => present(settings[key]));
  const configured = Number(api) + Number(account) + Number(sender);
  return status({
    id: "postnl",
    label: "PostNL",
    state: configured === 3 ? "ready" : configured === 0 ? "missing" : "attention",
    summary: configured === 3 ? "Sleutel, account en afzender zijn ingesteld." : "De verzendconfiguratie is niet compleet.",
    details: [
      `API-sleutel: ${api ? "aanwezig" : "ontbreekt"}`,
      `Accountgegevens: ${account ? "compleet" : "onvolledig"}`,
      `Afzenderadres: ${sender ? "compleet" : "onvolledig"}`,
      environment.POSTNL_SANDBOX === "true" ? "Omgeving: sandbox" : "Omgeving: productie",
    ],
    evidence: "configuration",
  });
}

function mailchimpStatus(environment: Record<string, string | undefined>): ProviderStatus {
  const marketingKeys = ["MAILCHIMP_API_KEY", "MAILCHIMP_SERVER_PREFIX", "MAILCHIMP_AUDIENCE_ID", "MAILCHIMP_WEBHOOK_SECRET"];
  const marketingCount = configuredCount(environment, marketingKeys);
  const marketingReady = marketingCount === marketingKeys.length;
  const transactionalReady = present(environment.MAILCHIMP_TRANSACTIONAL_API_KEY);
  const any = marketingCount > 0 || transactionalReady;
  return status({
    id: "mailchimp",
    label: "Mailchimp",
    state: marketingReady && transactionalReady ? "ready" : any ? "attention" : "missing",
    summary: marketingReady && transactionalReady ? "Marketing en Transactional zijn ingesteld." : any ? "De Mailchimp-configuratie is gedeeltelijk ingesteld." : "Mailchimp is niet ingesteld.",
    details: [
      `Marketing: ${marketingReady ? "compleet" : `${marketingCount} van ${marketingKeys.length} onderdelen aanwezig`}`,
      `Transactional: ${transactionalReady ? "sleutel aanwezig" : "niet ingesteld"}`,
      "Geen e-mail of providerverzoek uitgevoerd.",
    ],
    evidence: "configuration",
  });
}

function photoRoomStatus(availability: PhotoRoomAvailability): ProviderStatus {
  if (availability.status === "ready") {
    return status({ id: "photoroom", label: "PhotoRoom", state: "ready", summary: `${availability.availableCredits} credits beschikbaar.`, details: [`Benodigd per bewerking: ${availability.requiredCredits} credits.`, "Bewezen via de read-only accountcontrole."], evidence: "provider" });
  }
  if (availability.status === "insufficient_credits") {
    const exhausted = availability.availableCredits === 0;
    return status({
      id: "photoroom",
      label: "PhotoRoom",
      state: "blocked",
      summary: exhausted ? "Tegoed op: 0 credits beschikbaar." : `Tegoed te laag: ${availability.availableCredits} credits beschikbaar.`,
      details: [`Benodigd per bewerking: ${availability.requiredCredits} credits.`, "Bewezen via de read-only accountcontrole; er is geen beeldbewerking gestart."],
      evidence: "provider",
    });
  }
  if (availability.status === "not_configured") {
    return status({ id: "photoroom", label: "PhotoRoom", state: "missing", summary: "Geen API-sleutel ingesteld.", details: ["Geen providercontrole uitgevoerd."], evidence: "configuration" });
  }
  if (availability.status === "invalid_configuration") {
    return status({ id: "photoroom", label: "PhotoRoom", state: "attention", summary: "De accountcontrole is geweigerd.", details: ["Een geweigerde sleutel en onvoldoende tegoed zijn hiermee niet van elkaar te onderscheiden.", "De status beweert daarom niet dat het tegoed op is."], evidence: "provider" });
  }
  return status({ id: "photoroom", label: "PhotoRoom", state: "unavailable", summary: "De read-only accountcontrole gaf geen bruikbaar antwoord.", details: ["Er is geen beeldbewerking gestart."], evidence: "provider" });
}

function socialStatus(environment: Record<string, string | undefined>, accounts: SocialStatusAccount[] | null): ProviderStatus {
  const providers = [
    { label: "Meta", platforms: ["FACEBOOK", "INSTAGRAM"], keys: ["META_APP_ID", "META_APP_SECRET"] },
    { label: "TikTok", platforms: ["TIKTOK"], keys: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"] },
    { label: "YouTube", platforms: ["YOUTUBE"], keys: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"] },
  ];
  const configuredProviders = providers.filter((provider) => provider.keys.every((key) => present(environment[key]))).length;
  if (accounts === null) {
    return status({ id: "social", label: "Social media", state: "unavailable", summary: "Gekoppelde accounts konden niet worden gelezen.", details: providers.map((provider) => `${provider.label}: ${provider.keys.every((key) => present(environment[key])) ? "OAuth ingesteld" : "OAuth onvolledig"}`), evidence: "database" });
  }
  const connected = accounts.filter((account) => account.status === "CONNECTED");
  const details = providers.map((provider) => {
    const configured = provider.keys.every((key) => present(environment[key]));
    const count = connected.filter((account) => provider.platforms.includes(account.platform)).length;
    return `${provider.label}: ${configured ? "OAuth ingesteld" : "OAuth onvolledig"}, ${count} ${count === 1 ? "account" : "accounts"} gekoppeld`;
  });
  const ready = configuredProviders === providers.length && connected.length > 0;
  const any = configuredProviders > 0 || connected.length > 0;
  return status({
    id: "social",
    label: "Social media",
    state: ready ? "ready" : any ? "attention" : "missing",
    summary: ready ? `${connected.length} gekoppelde ${connected.length === 1 ? "account" : "accounts"}; alle OAuth-apps ingesteld.` : any ? "De social-koppelingen zijn gedeeltelijk ingesteld." : "Er zijn geen social-koppelingen ingesteld.",
    details,
    evidence: "database",
  });
}

export function buildProviderStatuses(
  input: ProviderStatusInput,
  checkedAt = new Date().toISOString(),
): IntegrationHealth[] {
  const { environment, settings, photoRoom, socialAccounts } = input;
  const ga4Ready = /^\d+$/u.test(environment.GA4_PROPERTY_ID?.trim() ?? "");
  const storageReady = present(environment.GCS_BUCKET);
  const geminiReady = present(environment.GEMINI_API_KEY) && environment.GEMINI_API_KEY?.trim() !== "MY_GEMINI_API_KEY";

  const statuses = [
    mollieStatus(environment),
    postnlStatus(environment, settings),
    mailchimpStatus(environment),
    status({ id: "ga4", label: "Google Analytics 4", state: ga4Ready ? "ready" : "missing", summary: ga4Ready ? "Property-ID ingesteld." : "Geen geldig property-ID ingesteld.", details: ["Toegang wordt pas bij een echte dashboardlezing gevalideerd.", "Geen Analytics-verzoek uitgevoerd."], evidence: "configuration" }),
    status({ id: "storage", label: "Bestandsopslag", state: storageReady ? "ready" : "missing", summary: storageReady ? "GCS-bucket ingesteld." : "Geen GCS-bucket ingesteld.", details: [`CDN-adres: ${present(environment.CDN_BASE_URL) ? "ingesteld" : "niet ingesteld"}`, "Bucketnaam en toegangsgegevens worden niet getoond; er is geen opslagverzoek uitgevoerd."], evidence: "configuration" }),
    status({ id: "gemini", label: "Gemini", state: geminiReady ? "ready" : "missing", summary: geminiReady ? "API-sleutel aanwezig." : "Geen bruikbare API-sleutel ingesteld.", details: ["Modeltoegang en quota zijn niet actief getest.", "Geen AI-aanroep uitgevoerd."], evidence: "configuration" }),
    photoRoomStatus(photoRoom),
    socialStatus(environment, socialAccounts),
  ];

  return statuses.map((provider) => ({
    ...provider,
    configured: provider.state !== "missing",
    status: provider.state,
    lastCheckedAt: checkedAt,
    error: provider.state === "attention" || provider.state === "blocked" || provider.state === "unavailable"
      ? {
          code: `${provider.id.toUpperCase()}_${provider.state.toUpperCase()}`,
          message: provider.summary,
        }
      : null,
  }));
}
