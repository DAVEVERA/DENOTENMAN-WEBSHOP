import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

export default async function AdminSettingsPage() {
  const settings = await getSettings([
    "postnl.customerCode",
    "postnl.customerNumber",
    "postnl.collectionLocation",
    "postnl.barcodeSerie",
    "postnl.senderName",
    "postnl.senderStreet",
    "postnl.senderHouseNumber",
    "postnl.senderPostalCode",
    "postnl.senderCity",
    "postnl.senderCountry",
  ]);

  return (
    <div>
      <h1 className="text-heading-xl text-text">Instellingen</h1>

      <section className="mt-6 max-w-3xl rounded-panel border border-border bg-surface p-5 shadow-card">
        <h2 className="text-heading-lg text-text">Integraties</h2>
        <p className="mt-1 text-body-sm text-muted">
          Bekijk veilig of betaal-, verzend-, marketing-, opslag-, AI- en social-koppelingen zijn ingesteld, zonder sleutels te tonen of betaalde acties uit te voeren.
        </p>
        <Link href="/admin/instellingen/integraties" className="mt-4 inline-flex min-h-11 items-center rounded-button border border-accent bg-accent px-4 font-heading text-body-sm font-semibold text-contrast shadow-button">
          Integratiestatus bekijken
        </Link>
      </section>

      <div className="mt-8 max-w-xl">
        <h2 className="text-heading-lg text-text">PostNL</h2>
        <p className="mt-1 text-body-sm text-muted">
          Accountgegevens voor het aanmaken van verzendlabels. De API-key staat al
          geconfigureerd.
        </p>

        <div className="mt-4">
          <SettingsForm
            customerCode={settings["postnl.customerCode"] ?? ""}
            customerNumber={settings["postnl.customerNumber"] ?? ""}
            collectionLocation={settings["postnl.collectionLocation"] ?? ""}
            barcodeSerie={settings["postnl.barcodeSerie"] ?? "00000000-99999999"}
            senderName={settings["postnl.senderName"] ?? ""}
            senderStreet={settings["postnl.senderStreet"] ?? ""}
            senderHouseNumber={settings["postnl.senderHouseNumber"] ?? ""}
            senderPostalCode={settings["postnl.senderPostalCode"] ?? ""}
            senderCity={settings["postnl.senderCity"] ?? ""}
            senderCountry={settings["postnl.senderCountry"] ?? "NL"}
          />
        </div>
      </div>
    </div>
  );
}
