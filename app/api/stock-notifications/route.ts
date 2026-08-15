import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const inputSchema = z.object({
  productId: z.string().cuid(),
  email: z.string().trim().email().max(254),
  locale: z.enum(["nl", "en", "fr"]),
  consent: z.literal(true),
  website: z.string().max(0).optional(),
});
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(request: NextRequest): boolean {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  if (attempts.size > 5000) {
    for (const [storedKey, value] of attempts) if (value.resetAt <= now) attempts.delete(storedKey);
    if (attempts.size > 5000) attempts.clear();
  }
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) { attempts.set(key, { count: 1, resetAt: now + 10 * 60_000 }); return false; }
  entry.count += 1;
  return entry.count > 10;
}

export async function POST(request: NextRequest) {
  if (rateLimited(request)) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  const product = await prisma.product.findUnique({ where: { id: parsed.data.productId }, select: { id: true, isActive: true } });
  if (!product) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (product.isActive) return NextResponse.json({ error: "ALREADY_AVAILABLE" }, { status: 409 });

  const emailNormalized = parsed.data.email.toLocaleLowerCase("nl-NL");
  const activeKey = `${product.id}:${emailNormalized}`;
  await prisma.stockNotification.upsert({
    where: { activeKey },
    update: { email: parsed.data.email, locale: parsed.data.locale, consentSource: "product-detail" },
    create: { productId: product.id, email: parsed.data.email, emailNormalized, locale: parsed.data.locale, consentSource: "product-detail", activeKey },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
