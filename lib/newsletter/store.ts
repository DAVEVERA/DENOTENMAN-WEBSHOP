import "server-only";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { newsletterDocumentSchema, type NewsletterDocument } from "./document";

export async function getNewsletterDocument(campaignId: string): Promise<NewsletterDocument | null> {
  const row = await prisma.newsletterDocument.findUnique({ where: { campaignId } });
  if (!row) return null;
  const parsed = newsletterDocumentSchema.safeParse(row.document);
  return parsed.success ? parsed.data : null;
}

export async function saveNewsletterDocument(campaignId: string, document: NewsletterDocument): Promise<void> {
  const value = document as unknown as Prisma.InputJsonValue;
  await prisma.newsletterDocument.upsert({ where: { campaignId }, update: { document: value }, create: { campaignId, document: value } });
}

export async function deleteNewsletterDocument(campaignId: string): Promise<void> {
  await prisma.newsletterDocument.deleteMany({ where: { campaignId } });
}
