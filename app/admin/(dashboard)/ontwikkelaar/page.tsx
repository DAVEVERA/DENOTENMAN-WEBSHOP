import type { Metadata } from "next";
import { connection } from "next/server";

import { DeveloperPortal } from "@/components/admin-panel/developer/DeveloperPortal";
import { developerPortalConfigured } from "@/lib/developer-portal/auth";
import { hasDeveloperPageSession, requireAdminPage } from "@/lib/developer-portal/page-auth";
import { developerProfileDto, getDeveloperProfile, listDeveloperInvoices } from "@/lib/developer-portal/service";

export const metadata: Metadata = { title: "Ontwikkelaar", robots: { index: false, follow: false } };

export default async function DeveloperPortalPage() {
  await connection();
  const { adminUserId } = await requireAdminPage();
  if (!(await hasDeveloperPageSession(adminUserId))) {
    return <DeveloperPortal mode="login" configured={developerPortalConfigured()} />;
  }
  const [invoices, profile] = await Promise.all([listDeveloperInvoices(), getDeveloperProfile()]);
  return <DeveloperPortal mode="portal" configured initialInvoices={invoices} initialProfile={developerProfileDto(profile)} />;
}
