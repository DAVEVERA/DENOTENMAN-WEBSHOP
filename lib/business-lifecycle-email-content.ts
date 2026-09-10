import "server-only";

import { prisma } from "@/lib/prisma";

export {
  BUSINESS_LIFECYCLE_EMAIL_DEFAULTS,
  BUSINESS_LIFECYCLE_EMAIL_KINDS,
  businessLifecycleEmailPatchSchema,
  substituteBusinessLifecycleTokens,
  type BusinessLifecycleEmailContentValue,
  type BusinessLifecycleEmailKindValue,
} from "@/lib/business-lifecycle-email-content-shared";

import { BUSINESS_LIFECYCLE_EMAIL_DEFAULTS, type BusinessLifecycleEmailKindValue } from "@/lib/business-lifecycle-email-content-shared";

export async function getBusinessLifecycleEmailContent(
  kind: BusinessLifecycleEmailKindValue
): Promise<{ subject: string; heading: string; bodyText: string; buttonLabel: string }> {
  const defaults = BUSINESS_LIFECYCLE_EMAIL_DEFAULTS[kind];
  const row = await prisma.businessLifecycleEmailContent.findUnique({ where: { kind } });
  if (!row) return defaults;
  return {
    subject: row.subject,
    heading: row.heading,
    bodyText: row.bodyText,
    buttonLabel: row.buttonLabel ?? defaults.buttonLabel,
  };
}
