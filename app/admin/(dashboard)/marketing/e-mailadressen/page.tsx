import Link from "next/link";
import { connection } from "next/server";
import { loadContacts } from "@/lib/marketing/contacts.server";
import type { Contact } from "@/lib/marketing/contacts-core";
import { ContactsTable } from "./ContactsTable";

export default async function EmailAddressesPage() {
  await connection();
  let contacts: Contact[] = [];
  let loadError: string | null = null;
  try {
    contacts = await loadContacts();
  } catch (error) {
    console.error("Loading newsletter contacts failed", { message: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200) });
    loadError = "De e-mailadressen konden niet uit Mailchimp worden geladen. Probeer het later opnieuw.";
  }

  return (
    <div>
      <Link href="/admin/marketing" className="text-body-sm text-accent-hover underline underline-offset-4">
        ← Terug naar marketing
      </Link>
      <div className="mt-3">
        <p className="font-heading text-body-sm font-bold uppercase tracking-heading text-accent-hover">Nieuwsbrief</p>
        <h1 className="mt-1 text-heading-xl text-text">E-mailadressen</h1>
        <p className="mt-1 max-w-3xl text-body-sm leading-6 text-muted">
          Alle adressen uit de Mailchimp-lijst, aangevuld met plaats, land en klanttype uit de webshop. Filter op Nederland of België
          en particulier of zakelijk, en maak direct een nieuwsbrief voor precies die groep.
        </p>
      </div>
      {loadError ? (
        <div className="mt-6 rounded-panel border border-red-300 bg-red-50 p-4 text-body-sm text-red-900">{loadError}</div>
      ) : (
        <ContactsTable contacts={contacts} />
      )}
    </div>
  );
}
