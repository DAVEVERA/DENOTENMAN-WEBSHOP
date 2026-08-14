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
