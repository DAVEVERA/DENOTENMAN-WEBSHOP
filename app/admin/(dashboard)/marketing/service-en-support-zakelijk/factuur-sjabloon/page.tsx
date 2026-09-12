import { connection } from "next/server";
import { getOrCreateDraftInvoiceCanvas } from "@/lib/invoice-template";
import { InvoiceTemplateEditor } from "./InvoiceTemplateEditor";

export default async function InvoiceTemplatePage() {
  await connection();
  const draft = await getOrCreateDraftInvoiceCanvas();
  return (
    <div>
      <h1 className="text-heading-xl text-text">Factuur-sjabloon</h1>
      <p className="mt-1 max-w-2xl text-body-sm text-muted">
        Voeg blokken toe, versleep ze in volgorde, en pas kleuren, lettertype en inhoud aan. Verplichte
        factuurgegevens (BTW, KVK, factuurnummer, artikelen) kunnen verplaatst maar nooit verwijderd worden
        zonder dat de factuur alsnog met standaardopmaak wordt gegenereerd.
      </p>
      <div className="mt-6">
        <InvoiceTemplateEditor templateId={draft.templateId} initialCanvas={draft.canvas} initialBlockText={draft.blockText} />
      </div>
    </div>
  );
}
