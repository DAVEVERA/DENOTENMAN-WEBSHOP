import { connection } from "next/server";
import { getOrCreateDraftInvoiceTemplate } from "@/lib/invoice-template";
import { InvoiceTemplateEditor } from "./InvoiceTemplateEditor";

export default async function InvoiceTemplatePage() {
  await connection();
  const draft = await getOrCreateDraftInvoiceTemplate();
  return (
    <div>
      <h1 className="text-heading-xl text-text">Factuur-sjabloon</h1>
      <p className="mt-1 max-w-2xl text-body-sm text-muted">
        Versleep en herschaal de vaste onderdelen van de factuur. Verplichte factuurgegevens (BTW, KVK,
        factuurnummer, artikelen) kunnen verplaatst maar nooit verwijderd worden.
      </p>
      <div className="mt-6">
        <InvoiceTemplateEditor templateId={draft.templateId} initialBlocks={draft.blocks} />
      </div>
    </div>
  );
}
