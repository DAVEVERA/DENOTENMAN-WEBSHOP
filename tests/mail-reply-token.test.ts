import assert from "node:assert/strict";
import test from "node:test";
import {
  INBOX_LOCAL_PART,
  MailReplyConfigError,
  mintReplyToken,
  parseReplyAddress,
  replyAddressFor,
} from "../lib/mail-reply/token";

const DOMAIN = "reply.denotenman.com";

test("an order address round-trips", () => {
  process.env.MAIL_REPLY_DOMAIN = DOMAIN;
  const token = mintReplyToken();
  const address = replyAddressFor({ kind: "order", token });

  assert.equal(address, `b-${token}@${DOMAIN}`);
  assert.deepEqual(parseReplyAddress(address), { kind: "order", token });
});

test("a business address uses its own prefix", () => {
  process.env.MAIL_REPLY_DOMAIN = DOMAIN;
  const token = mintReplyToken();

  assert.equal(replyAddressFor({ kind: "business", token }), `z-${token}@${DOMAIN}`);
  assert.deepEqual(parseReplyAddress(`z-abc123@${DOMAIN}`), { kind: "business", token: "abc123" });
});

test("the catch-all inbox and foreign addresses carry no target", () => {
  process.env.MAIL_REPLY_DOMAIN = DOMAIN;

  assert.equal(parseReplyAddress(`${INBOX_LOCAL_PART}@${DOMAIN}`), null);
  // The apex is Strato's: business mail, invoices and anything for Fedor must
  // never be claimed by a token lookup.
  assert.equal(parseReplyAddress("b-abc123@denotenman.com"), null);
  assert.equal(parseReplyAddress("fedor@denotenman.com"), null);
  assert.equal(parseReplyAddress("x-abc123@reply.denotenman.com"), null);
  assert.equal(parseReplyAddress("not an address"), null);
  assert.equal(parseReplyAddress(""), null);
});

test("an address is read case-insensitively without folding the token", () => {
  process.env.MAIL_REPLY_DOMAIN = DOMAIN;

  // Mail clients may rewrite the domain's case; the token is ours and stays as
  // minted, because the database lookup is exact.
  assert.deepEqual(parseReplyAddress("B-AbC123@REPLY.DENOTENMAN.COM"), {
    kind: "order",
    token: "AbC123",
  });
  assert.deepEqual(parseReplyAddress(`  b-abc123@${DOMAIN}  `), {
    kind: "order",
    token: "abc123",
  });
});

test("a reply-to with a display name is still recognised", () => {
  process.env.MAIL_REPLY_DOMAIN = DOMAIN;

  // Mandrill hands back whatever the sending client wrote in the header.
  assert.deepEqual(parseReplyAddress(`De Notenman <b-abc123@${DOMAIN}>`), {
    kind: "order",
    token: "abc123",
  });
});

test("a token is unguessable and carries no order id", () => {
  const token = mintReplyToken();

  assert.match(token, /^[0-9BCDFGHJKLMNPQRSTVWXZbcdfghjklmnpqrstvwxz_-]{22}$/);
  assert.notEqual(mintReplyToken(), token);

  const minted = new Set(Array.from({ length: 200 }, () => mintReplyToken()));
  assert.equal(minted.size, 200, "tokens repeat, so one customer could read another's thread");
});

test("a missing domain fails loudly instead of sending a broken address", () => {
  delete process.env.MAIL_REPLY_DOMAIN;

  assert.throws(() => replyAddressFor({ kind: "order", token: "abc" }), MailReplyConfigError);
  // Reading is different: without the setting nothing can match, but an
  // inbound message must still be stored rather than crash the webhook.
  assert.equal(parseReplyAddress(`b-abc123@${DOMAIN}`), null);
});
