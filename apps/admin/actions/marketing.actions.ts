"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "../lib/admin-auth";
import { createAuditLog } from "../lib/audit";
import {
  createMarketingBanner,
  createMarketingCampaign,
  createNewsletterCampaign,
  upsertDiscount,
} from "../lib/marketing";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(formData: FormData, key: string) {
  const value = Number(getString(formData, key).replace(",", "."));
  if (!Number.isFinite(value)) throw new Error(`Ongeldige waarde voor ${key}.`);
  return value;
}

export async function saveDiscountAction(formData: FormData) {
  const session = await requireAdmin();
  const code = getString(formData, "code").toUpperCase();

  if (!code) throw new Error("Kortingscode is verplicht.");

  await upsertDiscount({
    code,
    name: getString(formData, "name") || null,
    discountType: getString(formData, "discountType") || "percent",
    value: getNumber(formData, "value"),
    isActive: formData.get("isActive") === "on",
  });
  await createAuditLog({
    actorEmail: session.email,
    action: "Korting opgeslagen",
    entityType: "discount",
    entityId: code,
  });
  revalidatePath("/kortingen");
  redirect("/kortingen");
}

export async function saveMarketingBannerAction(formData: FormData) {
  const session = await requireAdmin();
  const title = getString(formData, "title");
  const position = getString(formData, "position");

  if (!title || !position) throw new Error("Titel en positie zijn verplicht.");

  const id = await createMarketingBanner({
    title,
    position,
    image: getString(formData, "image") || null,
    href: getString(formData, "href") || null,
    status: getString(formData, "status") || "draft",
    startsAt: getString(formData, "startsAt") || null,
    endsAt: getString(formData, "endsAt") || null,
  });

  await createAuditLog({
    actorEmail: session.email,
    action: "Marketingbanner aangemaakt",
    entityType: "marketing_banner",
    entityId: id,
  });
  revalidatePath("/marketing");
  revalidatePath("/marketing/banners");
  redirect("/marketing/banners");
}

export async function saveMarketingCampaignAction(formData: FormData) {
  const session = await requireAdmin();
  const title = getString(formData, "title");

  if (!title) throw new Error("Titel is verplicht.");

  const id = await createMarketingCampaign({
    title,
    channel: getString(formData, "channel") || "site",
    status: getString(formData, "status") || "draft",
    startsAt: getString(formData, "startsAt") || null,
    endsAt: getString(formData, "endsAt") || null,
  });

  await createAuditLog({
    actorEmail: session.email,
    action: "Marketingactie aangemaakt",
    entityType: "marketing_campaign",
    entityId: id,
  });
  revalidatePath("/marketing");
  revalidatePath("/marketing/acties");
  redirect("/marketing/acties");
}

export async function saveNewsletterCampaignAction(formData: FormData) {
  const session = await requireAdmin();
  const title = getString(formData, "title");

  if (!title) throw new Error("Titel is verplicht.");

  const id = await createNewsletterCampaign({
    title,
    subject: getString(formData, "subject") || null,
    audience: getString(formData, "audience") || null,
    status: getString(formData, "status") || "draft",
    sentAt: getString(formData, "sentAt") || null,
  });

  await createAuditLog({
    actorEmail: session.email,
    action: "Nieuwsbrief aangemaakt",
    entityType: "newsletter_campaign",
    entityId: id,
  });
  revalidatePath("/marketing");
  revalidatePath("/marketing/nieuwsbrieven");
  redirect("/marketing/nieuwsbrieven");
}
