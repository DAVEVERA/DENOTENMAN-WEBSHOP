import type { NextRequest } from "next/server";
import { z } from "zod";

import { developerErrorResponse, developerJson, readJson, requireDeveloper } from "@/lib/developer-portal/http";
import {
  cancelDeveloperInvoice,
  deleteDeveloperInvoice,
  getDeveloperInvoice,
  markDeveloperInvoicePaid,
  resendDeveloperInvoiceNotice,
  sendDeveloperInvoice,
  updateDeveloperInvoice,
} from "@/lib/developer-portal/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send"), notify: z.boolean().optional() }).strict(),
  z.object({ action: z.literal("resend") }).strict(),
  z.object({ action: z.literal("cancel") }).strict(),
  z.object({ action: z.literal("markPaid"), via: z.enum(["bank", "stripe", "link", "other"]) }).strict(),
]);

export async function GET(request: NextRequest, context: Context) {
  const guard = await requireDeveloper(request);
  if (guard.response) return guard.response;
  try {
    return developerJson({ invoice: await getDeveloperInvoice((await context.params).id) });
  } catch (error) {
    return developerErrorResponse(error);
  }
}

/** Replaces a draft's content. */
export async function PUT(request: NextRequest, context: Context) {
  const guard = await requireDeveloper(request, { write: true });
  if (guard.response) return guard.response;
  try {
    return developerJson({ invoice: await updateDeveloperInvoice((await context.params).id, await readJson(request)) });
  } catch (error) {
    return developerErrorResponse(error);
  }
}

/** Status changes: send (set ready), resend the notice, cancel or mark as paid. */
export async function POST(request: NextRequest, context: Context) {
  const guard = await requireDeveloper(request, { write: true });
  if (guard.response) return guard.response;
  try {
    const { id } = await context.params;
    const input = actionSchema.parse(await readJson(request));
    const invoice = input.action === "send"
      ? await sendDeveloperInvoice(id, undefined, { notify: input.notify })
      : input.action === "resend"
        ? await resendDeveloperInvoiceNotice(id)
        : input.action === "cancel"
          ? await cancelDeveloperInvoice(id)
          : await markDeveloperInvoicePaid(id, input.via);
    return developerJson({ invoice });
  } catch (error) {
    return developerErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const guard = await requireDeveloper(request, { write: true });
  if (guard.response) return guard.response;
  try {
    await deleteDeveloperInvoice((await context.params).id);
    return developerJson({ ok: true });
  } catch (error) {
    return developerErrorResponse(error);
  }
}
