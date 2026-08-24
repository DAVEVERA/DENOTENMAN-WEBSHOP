import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { claimBusinessLoginLinkIpAllowance, requestBusinessLoginLink } from "@/lib/business-portal";

export const runtime = "nodejs";
const schema = z.object({ email: z.string().trim().email().max(320) }).strict();

function clientAddress(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  // Cloud Run appends the real client and load-balancer addresses. Using the
  // penultimate value prevents a caller-supplied leftmost value from becoming
  // an easy rate-limit bypass.
  if (forwarded?.length) return forwarded.length >= 2 ? forwarded.at(-2)! : forwarded[0];
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (parsed.success) {
    const email = parsed.data.email;
    const address = clientAddress(request);
    after(async () => {
      try {
        if (await claimBusinessLoginLinkIpAllowance(address)) {
          await requestBusinessLoginLink(email);
        }
      } catch (error) {
        console.error("Business login-link request could not be completed", error);
      }
    });
  }
  return NextResponse.json(
    { ok: true, message: "Als dit e-mailadres bij een actief zakelijk account hoort, ontvangt u een persoonlijke inloglink." },
    { status: 202, headers: { "Cache-Control": "no-store" } }
  );
}
