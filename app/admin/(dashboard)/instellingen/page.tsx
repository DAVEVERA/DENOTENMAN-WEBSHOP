import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

export default async function AdminSettingsPage() {
  const settings = await getSettings([
    "postnl.customerCode",
    "postnl.customerNumber",
    "postnl.collectionLocation",
  ]);

  return (
    <div>
      <h1 className="text-heading-xl text-text">Instellingen</h1>

      <div className="mt-8 max-w-xl">
        <h2 className="text-heading-lg text-text">PostNL</h2>
        <p className="mt-1 text-body-sm text-muted">
          Accountgegevens voor het aanmaken van verzendlabels. De API-key staat al
          geconfigureerd; deze drie velden ontbraken nog.
        </p>

        <div className="mt-4">
          <SettingsForm
            customerCode={settings["postnl.customerCode"] ?? ""}
            customerNumber={settings["postnl.customerNumber"] ?? ""}
            collectionLocation={settings["postnl.collectionLocation"] ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
