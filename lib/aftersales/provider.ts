import "server-only";
import { Resend } from "resend";

export type AftersalesMailPayload = {
  deliveryId: string;
  orderId: string;
  trigger: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type AftersalesProviderResult = {
  provider: "MAILCHIMP_TRANSACTIONAL" | "RESEND_FALLBACK";
  messageId: string;
  providerStatus: string;
};

export class TransactionalProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "TransactionalProviderError";
  }
}

function configuredSenderEmail(): string {
  for (const rawValue of [process.env.MAIL_FROM_EMAIL, process.env.MAIL_FROM_ADDRESS]) {
    const value = rawValue?.trim();
    if (!value) continue;
    const bracketed = value.match(/<([^<>]+)>\s*$/)?.[1]?.trim();
    const candidate = bracketed || value;
    if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(candidate)) return candidate;
  }
  return "bestellingen@denotenman.com";
}

function assertProviderTlsVerification(): void {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    throw new TransactionalProviderError(
      "TLS-certificaatcontrole is uitgeschakeld; de transactionele provider-call is veilig afgebroken",
      "INSECURE_TLS_CONFIGURATION",
      false
    );
  }
}

function sender(): { email: string; name: string; replyTo?: string } {
  return {
    email: configuredSenderEmail(),
    name: process.env.MAIL_FROM_NAME?.trim() || "De Notenman",
    replyTo: process.env.MAIL_REPLY_TO?.trim() || undefined,
  };
}

async function sendWithMailchimp(payload: AftersalesMailPayload): Promise<AftersalesProviderResult> {
  assertProviderTlsVerification();
  const key = process.env.MAILCHIMP_TRANSACTIONAL_API_KEY?.trim();
  if (!key) {
    throw new TransactionalProviderError(
      "MAILCHIMP_TRANSACTIONAL_API_KEY ontbreekt",
      "MAILCHIMP_TRANSACTIONAL_NOT_CONFIGURED",
      false
    );
  }

  const from = sender();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://mandrillapp.com/api/1.0/messages/send.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        key,
        message: {
          from_email: from.email,
          from_name: from.name,
          ...(from.replyTo ? { headers: { "Reply-To": from.replyTo } } : {}),
          to: [{ email: payload.to, type: "to" }],
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          tags: ["aftersales", payload.trigger.toLowerCase()],
          metadata: { order_id: payload.orderId, delivery_id: payload.deliveryId },
          important: true,
          track_opens: true,
          track_clicks: true,
          auto_text: false,
          inline_css: true,
        },
        async: false,
      }),
    });
    const body = await response.json().catch(() => null) as unknown;
    if (!response.ok) {
      const providerMessage = typeof body === "object" && body && "message" in body
        ? String((body as { message: unknown }).message)
        : `HTTP ${response.status}`;
      const providerCode = typeof body === "object" && body && "name" in body
        ? String((body as { name: unknown }).name)
        : `HTTP_${response.status}`;
      throw new TransactionalProviderError(
        `Mailchimp Transactional weigerde de mail: ${providerMessage}`,
        providerCode,
        response.status === 429 || response.status >= 500
      );
    }

    const result = Array.isArray(body) ? body[0] : null;
    if (!result || typeof result !== "object") {
      throw new TransactionalProviderError(
        "Mailchimp gaf geen verzendresultaat terug",
        "INVALID_PROVIDER_RESPONSE",
        false
      );
    }

    const resultEmail = "email" in result ? String(result.email).trim().toLowerCase() : "";
    if (resultEmail !== payload.to.trim().toLowerCase()) {
      throw new TransactionalProviderError(
        "Mailchimp bevestigde niet dezelfde ontvanger als in de verzendopdracht",
        "RECIPIENT_MISMATCH",
        false
      );
    }

    const status = "status" in result ? String(result.status) : "";
    if (status !== "sent" && status !== "queued" && status !== "scheduled") {
      const reason = "reject_reason" in result
        ? String(result.reject_reason || "onbekend")
        : "onbekend";
      throw new TransactionalProviderError(
        `Mailchimp heeft de mail niet geaccepteerd (${status || reason})`,
        reason === "onbekend" ? "MAILCHIMP_REJECTED" : reason,
        false
      );
    }

    return {
      provider: "MAILCHIMP_TRANSACTIONAL",
      messageId: "_id" in result ? String(result._id) : payload.deliveryId,
      providerStatus: status,
    };
  } catch (error) {
    if (error instanceof TransactionalProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new TransactionalProviderError(
        "Mailchimp Transactional antwoordde niet binnen 15 seconden; afleverstatus is onbekend",
        "PROVIDER_TIMEOUT",
        false
      );
    }
    throw new TransactionalProviderError(
      error instanceof Error ? error.message : "Onbekende Mailchimp-verzendfout",
      "PROVIDER_NETWORK_ERROR",
      false
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function sendWithResend(payload: AftersalesMailPayload): Promise<AftersalesProviderResult> {
  assertProviderTlsVerification();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new TransactionalProviderError(
      "Geen transactionele mailprovider geconfigureerd",
      "TRANSACTIONAL_PROVIDER_NOT_CONFIGURED",
      false
    );
  }

  const from = sender();
  const { data, error } = await new Resend(apiKey).emails.send({
    from: `${from.name} <${from.email}>`,
    to: payload.to,
    replyTo: from.replyTo,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    tags: [
      { name: "type", value: "aftersales" },
      { name: "order_id", value: payload.orderId || "none" },
    ],
  }, { idempotencyKey: `transactional-${payload.deliveryId}` });

  if (error) {
    throw new TransactionalProviderError(
      `Resend weigerde de mail: ${error.message}`,
      error.name || `HTTP_${error.statusCode ?? 0}`,
      error.statusCode === 429 || (error.statusCode ?? 0) >= 500
    );
  }

  return {
    provider: "RESEND_FALLBACK",
    messageId: data?.id ?? payload.deliveryId,
    providerStatus: "accepted",
  };
}

export async function sendAftersalesMail(
  payload: AftersalesMailPayload
): Promise<AftersalesProviderResult> {
  if (process.env.MAILCHIMP_TRANSACTIONAL_API_KEY?.trim()) {
    return sendWithMailchimp(payload);
  }
  return sendWithResend(payload);
}

export function aftersalesProviderStatus(): {
  provider: "mailchimp" | "resend" | "none";
  label: string;
  detail: string;
} {
  if (process.env.MAILCHIMP_TRANSACTIONAL_API_KEY?.trim()) {
    return {
      provider: "mailchimp",
      label: "Mailchimp Transactional geconfigureerd",
      detail: "Transactionele API-key gevonden; provideracceptatie wordt per mail gelogd.",
    };
  }
  if (process.env.RESEND_API_KEY?.trim()) {
    return {
      provider: "resend",
      label: "Resend geconfigureerd",
      detail:
        "MAILCHIMP_API_KEY is alleen voor Marketing. Voor Mailchimp Transactional is MAILCHIMP_TRANSACTIONAL_API_KEY nodig.",
    };
  }
  return {
    provider: "none",
    label: "Geen transactionele mailprovider geconfigureerd",
    detail:
      "Koppel MAILCHIMP_TRANSACTIONAL_API_KEY of een verzendklare RESEND_API_KEY voordat de flow wordt geactiveerd.",
  };
}

export type TransactionalProviderReadiness = {
  ready: boolean;
  provider: "mailchimp" | "resend" | "none";
  message: string;
  reason?: "demo_mode" | "quota_unavailable" | "insecure_tls";
};

function senderDomain(): string {
  return sender().email.split("@")[1]?.trim().toLowerCase() ?? "";
}

export async function checkTransactionalProviderReadiness(): Promise<TransactionalProviderReadiness> {
  const configured = aftersalesProviderStatus();
  if (configured.provider === "none") {
    return { ready: false, provider: "none", message: configured.detail };
  }
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    return {
      ready: false,
      provider: configured.provider,
      reason: "insecure_tls",
      message: "TLS-certificaatcontrole is uitgeschakeld; providercontrole en verzending zijn veilig geblokkeerd.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    if (configured.provider === "mailchimp") {
      const key = process.env.MAILCHIMP_TRANSACTIONAL_API_KEY?.trim();
      const userResponse = await fetch("https://mandrillapp.com/api/1.0/users/info.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ key }),
      });
      if (!userResponse.ok) {
        const body = await userResponse.json().catch(() => null) as { message?: unknown } | null;
        return {
          ready: false,
          provider: "mailchimp",
          message: `Mailchimp Transactional-key geweigerd: ${String(body?.message ?? `HTTP ${userResponse.status}`)}`,
        };
      }

      const user = await userResponse.json().catch(() => null) as {
        hourly_quota?: unknown;
        reputation?: unknown;
      } | null;
      const hourlyQuota = Number(user?.hourly_quota);
      if (hourlyQuota === 25) {
        return {
          ready: false,
          provider: "mailchimp",
          reason: "demo_mode",
          message:
            "Mailchimp Transactional-key is geldig, maar het account staat nog in demo-modus (maximaal 25 mails per uur en alleen ontvangers op het eigen domein).",
        };
      }
      if (!Number.isFinite(hourlyQuota) || hourlyQuota <= 0) {
        return {
          ready: false,
          provider: "mailchimp",
          reason: "quota_unavailable",
          message: Number.isFinite(hourlyQuota)
            ? `Mailchimp Transactional accepteert de key, maar rapporteert verzendquota ${hourlyQuota}. De betaalde add-on is mogelijk nog niet volledig geprovisioneerd.`
            : "Mailchimp Transactional accepteert de key, maar retourneert geen geldige verzendquota.",
        };
      }

      const domainsResponse = await fetch("https://mandrillapp.com/api/1.0/senders/domains.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ key }),
      });
      if (!domainsResponse.ok) {
        return {
          ready: false,
          provider: "mailchimp",
          message: `Mailchimp kon de verzenddomeinen niet controleren (HTTP ${domainsResponse.status}).`,
        };
      }
      const domains = await domainsResponse.json().catch(() => null) as Array<{
        domain?: unknown;
        verified_at?: unknown;
        spf?: { valid?: unknown };
        dkim?: { valid?: unknown };
      }> | null;
      const domain = senderDomain();
      const match = Array.isArray(domains)
        ? domains.find((item) => String(item.domain).toLowerCase() === domain)
        : undefined;
      if (!match?.verified_at || match.spf?.valid !== true || match.dkim?.valid !== true) {
        const missing = [
          !match?.verified_at ? "domeinverificatie" : null,
          match?.spf?.valid !== true ? "SPF" : null,
          match?.dkim?.valid !== true ? "DKIM" : null,
        ].filter(Boolean).join(", ");
        return {
          ready: false,
          provider: "mailchimp",
          message: `Mailchimp-key is geldig, maar verzenddomein ${domain || "onbekend"} is niet verzendklaar: ${missing}.`,
        };
      }
      return {
        ready: true,
        provider: "mailchimp",
        message: `Mailchimp Transactional-key en verzenddomein ${domain} zijn productiegeschikt (actuele quota ${hourlyQuota} per uur).`,
      };
    }

    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY?.trim()}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        ready: false,
        provider: "resend",
        message: `Resend-key geweigerd (HTTP ${response.status}).`,
      };
    }
    const body = await response.json().catch(() => null) as {
      data?: Array<{ name?: unknown; status?: unknown }>;
    } | null;
    const domain = senderDomain();
    const match = body?.data?.find((item) => String(item.name).toLowerCase() === domain);
    if (!match || String(match.status).toLowerCase() !== "verified") {
      return {
        ready: false,
        provider: "resend",
        message: `Resend-key is geldig, maar verzenddomein ${domain || "onbekend"} is niet geverifieerd.`,
      };
    }
    return {
      ready: true,
      provider: "resend",
      message: `Resend-key en verzenddomein ${domain} zijn geverifieerd.`,
    };
  } catch (error) {
    return {
      ready: false,
      provider: configured.provider,
      message: error instanceof Error && error.name === "AbortError"
        ? "Providercontrole duurde langer dan 8 seconden."
        : `Providercontrole mislukt: ${error instanceof Error ? error.message : "onbekende fout"}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}
