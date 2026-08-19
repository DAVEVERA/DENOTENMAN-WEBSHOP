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
};

function sender(): { email: string; name: string; replyTo?: string } {
  return {
    email: process.env.MAIL_FROM_EMAIL?.trim() || "bestellingen@denotenman.com",
    name: process.env.MAIL_FROM_NAME?.trim() || "De Notenman",
    replyTo: process.env.MAIL_REPLY_TO?.trim() || undefined,
  };
}

async function sendWithMailchimp(payload: AftersalesMailPayload): Promise<AftersalesProviderResult> {
  const key = process.env.MAILCHIMP_TRANSACTIONAL_API_KEY?.trim();
  if (!key) throw new Error("MAILCHIMP_TRANSACTIONAL_API_KEY ontbreekt");
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
      throw new Error(`Mailchimp Transactional weigerde de mail: ${providerMessage}`);
    }
    const result = Array.isArray(body) ? body[0] : null;
    if (!result || typeof result !== "object") throw new Error("Mailchimp gaf geen verzendresultaat terug");
    const status = "status" in result ? String(result.status) : "";
    if (status !== "sent" && status !== "queued" && status !== "scheduled") {
      const reason = "reject_reason" in result ? String(result.reject_reason || "onbekend") : "onbekend";
      throw new Error(`Mailchimp heeft de mail niet geaccepteerd (${status || reason})`);
    }
    const messageId = "_id" in result ? String(result._id) : payload.deliveryId;
    return { provider: "MAILCHIMP_TRANSACTIONAL", messageId };
  } finally {
    clearTimeout(timeout);
  }
}

async function sendWithResend(payload: AftersalesMailPayload): Promise<AftersalesProviderResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("Geen transactionele mailprovider geconfigureerd");
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
      { name: "order_id", value: payload.orderId },
    ],
  }, { idempotencyKey: `aftersales-${payload.deliveryId}` });
  if (error) throw new Error(`Resend fallback weigerde de mail: ${error.message}`);
  return { provider: "RESEND_FALLBACK", messageId: data?.id ?? payload.deliveryId };
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
} {
  if (process.env.MAILCHIMP_TRANSACTIONAL_API_KEY?.trim()) {
    return { provider: "mailchimp", label: "Mailchimp Transactional actief" };
  }
  if (process.env.RESEND_API_KEY?.trim()) {
    return { provider: "resend", label: "Resend fallback actief — Mailchimp-key ontbreekt" };
  }
  return { provider: "none", label: "Geen transactionele mailprovider geconfigureerd" };
}
