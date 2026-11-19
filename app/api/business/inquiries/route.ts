import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { LEGAL_IDENTITY } from "@/lib/legal";

const inquirySchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional().default(""),
  topic: z.enum(["bestellijst", "assortiment", "levering", "anders"]),
  message: z.string().trim().min(10).max(3000),
  website: z.string().max(200).optional().default(""),
});

const topicLabels = {
  bestellijst: "Zakelijke bestellijst",
  assortiment: "Assortiment en hoeveelheden",
  levering: "Bezorging of afhalen",
  anders: "Ander onderwerp",
} as const;

const requests = new Map<string, { count: number; until: number }>();

function limited(request: NextRequest): boolean {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  if (requests.size > 5000) for (const [ip, entry] of requests) if (entry.until < now) requests.delete(ip);
  const previous = requests.get(key);
  const next = previous && previous.until > now ? { count: previous.count + 1, until: previous.until } : { count: 1, until: now + 10 * 60_000 };
  requests.set(key, next);
  return next.count > 5;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function senderEmail(): string {
  const configured = (process.env.MAIL_FROM_EMAIL || process.env.MAIL_FROM_ADDRESS || "bestellingen@denotenman.com").trim();
  return configured.match(/<([^<>]+)>\s*$/)?.[1] || configured;
}

async function sendInquiry(input: z.infer<typeof inquirySchema>): Promise<void> {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new Error("INSECURE_TLS_CONFIGURATION");
  const subject = `Zakelijke aanvraag: ${input.companyName.replace(/[\r\n]/g, " ").slice(0, 90)}`;
  const lines = [
    `Bedrijf: ${input.companyName}`,
    `Contactpersoon: ${input.contactName}`,
    `E-mail: ${input.email}`,
    `Telefoon: ${input.phone || "Niet opgegeven"}`,
    `Onderwerp: ${topicLabels[input.topic]}`,
    "",
    input.message,
  ];
  const text = lines.join("\n");
  const html = `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</div>`;
  const from = senderEmail();
  const transactionalKey = process.env.MAILCHIMP_TRANSACTIONAL_API_KEY?.trim();

  if (transactionalKey) {
    const response = await fetch("https://mandrillapp.com/api/1.0/messages/send.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: transactionalKey, message: { from_email: from, from_name: "De Notenman", to: [{ email: LEGAL_IDENTITY.email, type: "to" }], headers: { "Reply-To": input.email }, subject, html, text } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("MAILCHIMP_SEND_FAILED");
    const result = await response.json().catch(() => null) as Array<{ status?: string }> | null;
    if (!Array.isArray(result) || !result.some((item) => item.status === "sent" || item.status === "queued" || item.status === "scheduled")) throw new Error("MAILCHIMP_REJECTED");
    return;
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!resendKey) throw new Error("MAIL_PROVIDER_NOT_CONFIGURED");
  const { error } = await new Resend(resendKey).emails.send({
    from: `De Notenman <${from}>`,
    to: LEGAL_IDENTITY.email,
    replyTo: input.email,
    subject,
    html,
    text,
    tags: [{ name: "type", value: "business_inquiry" }],
  });
  if (error) throw new Error("RESEND_SEND_FAILED");
}

export async function POST(request: NextRequest) {
  if (limited(request)) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const parsed = inquirySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  if (parsed.data.website) return NextResponse.json({ ok: true });

  try {
    await sendInquiry(parsed.data);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Business inquiry delivery failed", { code: error instanceof Error ? error.message : "UNKNOWN" });
    return NextResponse.json({ error: "DELIVERY_FAILED" }, { status: 503 });
  }
}
