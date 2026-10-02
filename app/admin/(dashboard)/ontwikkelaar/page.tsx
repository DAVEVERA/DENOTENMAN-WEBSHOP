import type { Metadata } from "next";
import { connection } from "next/server";

import { DeveloperPortal } from "@/components/admin-panel/developer/DeveloperPortal";
import { developerPortalConfigured } from "@/lib/developer-portal/auth";
import { hasDeveloperPageSession, requireAdminPage } from "@/lib/developer-portal/page-auth";
import { confirmOpenDeveloperInvoicePayments, developerProfileDto, getDeveloperProfile, listDeveloperDevices, listDeveloperInvoices, listDeveloperInvoiceViews } from "@/lib/developer-portal/service";

export const metadata: Metadata = { title: "Ontwikkelaar", robots: { index: false, follow: false } };

export default async function DeveloperPortalPage() {
  await connection();
  const { adminUserId } = await requireAdminPage();
  if (!(await hasDeveloperPageSession(adminUserId))) {
    return <DeveloperPortal mode="login" configured={developerPortalConfigured()} />;
  }
  await confirmOpenDeveloperInvoicePayments().catch(() => undefined);
  // Only after the developer login: who looked at the invoices, and with which devices.
  const [invoices, profile, views, devices] = await Promise.all([listDeveloperInvoices(), getDeveloperProfile(), listDeveloperInvoiceViews(), listDeveloperDevices()]);
  return <DeveloperPortal mode="portal" configured initialInvoices={invoices} initialProfile={developerProfileDto(profile)} initialViews={views} initialDevices={devices} />;
}
