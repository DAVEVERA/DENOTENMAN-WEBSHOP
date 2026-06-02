import "server-only";
import { getAdminSession } from "./admin-auth";
import { createAdminSupabaseClient } from "./supabase/server";

async function listStoredSettings() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.from("admin_settings").select("key,value,updated_at");

  if (error) return {};

  return Object.fromEntries(
    (data ?? []).map((row: any) => [String(row.key), row.value ?? {}]),
  ) as Record<string, Record<string, unknown>>;
}

export async function getAdminSettingsStatus() {
  const [session, stored] = await Promise.all([getAdminSession(), listStoredSettings()]);
  const general = stored.general ?? {};
  const email = stored.email ?? {};

  return {
    general: {
      shopName: String(general.shopName ?? "De Notenman"),
      siteUrl: String(general.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? ""),
      adminUrl: String(general.adminUrl ?? process.env.ADMIN_URL ?? ""),
      mailFromName: String(email.mailFromName ?? general.mailFromName ?? process.env.MAIL_FROM_NAME ?? ""),
      mailFromEmail: String(email.mailFromEmail ?? general.mailFromEmail ?? process.env.MAIL_FROM_EMAIL ?? ""),
    },
    payments: {
      mollieConfigured: Boolean(process.env.MOLLIE_API_KEY),
      mollieTestPaymentsEnabled:
        process.env.MOLLIE_ENABLE_PAYMENTS === "true" &&
        process.env.MOLLIE_API_KEY?.startsWith("test_") === true,
      webhookPath: "/api/mollie/webhook",
    },
    shipping: {
      postnlConfigured: Boolean(process.env.POSTNL_API_KEY),
      postnlCustomerCodeConfigured: Boolean(process.env.POSTNL_CUSTOMER_CODE),
      postnlCustomerNumberConfigured: Boolean(process.env.POSTNL_CUSTOMER_NUMBER),
    },
    users: [
      {
        email: session?.email ?? process.env.ADMIN_EMAIL ?? "Niet ingesteld",
        role: "Eigenaar",
        status: session ? "Actieve sessie" : "Geen actieve sessie",
      },
    ],
    roles: [
      {
        name: "Eigenaar",
        permissions: "Volledige toegang tot de adminomgeving via server-side adminsessie.",
      },
    ],
  };
}
