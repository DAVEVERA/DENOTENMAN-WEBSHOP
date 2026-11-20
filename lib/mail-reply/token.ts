import { randomBytes } from "node:crypto";

/**
 * Customer replies arrive on a subdomain of their own, so the apex keeps
 * delivering business mail, invoices and anything for Fedor to Strato. The
 * local part of the address carries a token that binds the reply to an order
 * or a business account, which is what makes a reply from a different mailbox
 * still land in the right thread.
 */
export type ReplyTarget = { kind: "order" | "business"; token: string };

/** Mail sent here has no token: the Strato forward for bestellingen@ lands on it. */
export const INBOX_LOCAL_PART = "inbox";

const PREFIX_BY_KIND: Record<ReplyTarget["kind"], string> = {
  order: "b",
  business: "z",
};

const KIND_BY_PREFIX: Record<string, ReplyTarget["kind"]> = {
  b: "order",
  z: "business",
};

/** No vowels, so a token can never spell a word a customer would read into. */
const ALPHABET = "0123456789BCDFGHJKLMNPQRSTVWXZbcdfghjklmnpqrstvwxz_-";
const TOKEN_LENGTH = 22;
/** Largest multiple of the alphabet that fits in a byte; the rest is rejected
 *  rather than wrapped, which would make the early letters more likely. */
const UNBIASED_CEILING = Math.floor(256 / ALPHABET.length) * ALPHABET.length;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export class MailReplyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailReplyConfigError";
  }
}

function replyDomain(): string | null {
  const domain = process.env.MAIL_REPLY_DOMAIN?.trim().toLowerCase();
  return domain ? domain : null;
}

export function mintReplyToken(): string {
  let token = "";
  while (token.length < TOKEN_LENGTH) {
    for (const byte of randomBytes(TOKEN_LENGTH)) {
      if (byte >= UNBIASED_CEILING) continue;
      token += ALPHABET[byte % ALPHABET.length];
      if (token.length === TOKEN_LENGTH) break;
    }
  }
  return token;
}

export function replyAddressFor(target: ReplyTarget): string {
  const domain = replyDomain();
  if (!domain) {
    throw new MailReplyConfigError(
      "MAIL_REPLY_DOMAIN ontbreekt; zonder antwoorddomein kan er geen antwoordadres worden gezet"
    );
  }
  return `${PREFIX_BY_KIND[target.kind]}-${target.token}@${domain}`;
}

/**
 * Reading never throws. An inbound message with an address we cannot place
 * has to be stored unbound, because the webhook must answer 200 or Mandrill
 * keeps redelivering it.
 */
export function parseReplyAddress(address: string): ReplyTarget | null {
  const domain = replyDomain();
  if (!domain) return null;

  const trimmed = address.trim();
  if (!trimmed) return null;

  // Mandrill hands back the header as the sending client wrote it, which may
  // be "Name <address>".
  const bracketed = /<([^<>]+)>\s*$/.exec(trimmed);
  const bare = (bracketed ? bracketed[1] : trimmed).trim();

  const at = bare.lastIndexOf("@");
  if (at < 1) return null;

  if (bare.slice(at + 1).toLowerCase() !== domain) return null;

  const localPart = bare.slice(0, at);
  const separator = localPart.indexOf("-");
  if (separator !== 1) return null;

  const kind = KIND_BY_PREFIX[localPart[0].toLowerCase()];
  if (!kind) return null;

  // The token keeps the case it was minted with: the lookup is an exact match.
  const token = localPart.slice(2);
  if (!TOKEN_PATTERN.test(token)) return null;

  return { kind, token };
}
