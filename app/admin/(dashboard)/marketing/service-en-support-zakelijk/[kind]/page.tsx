import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getBusinessLifecycleEmailContent, type BusinessLifecycleEmailKindValue } from "@/lib/business-lifecycle-email-content";
import { BusinessLifecycleEmailForm } from "./BusinessLifecycleEmailForm";

const KIND_MAP: Record<string, { value: BusinessLifecycleEmailKindValue; title: string; tokens: string[] }> = {
  invitation: { value: "INVITATION", title: "Uitnodiging", tokens: ["contactName", "companyName"] },
  invoice: { value: "INVOICE", title: "Factuur", tokens: ["invoiceNumber", "recipientName", "companyName"] },
};

export default async function BusinessLifecycleEmailEditPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  await connection();
  const { kind: rawKind } = await params;
  const entry = KIND_MAP[rawKind];
  if (!entry) notFound();

  const content = await getBusinessLifecycleEmailContent(entry.value);

  return (
    <div>
      <Link
        href="/admin/marketing/service-en-support-zakelijk"
        className="text-body-sm text-accent-hover underline underline-offset-4"
      >
        ← Terug naar service en support zakelijk
      </Link>
      <div className="mt-3">
        <h1 className="text-heading-xl text-text">{entry.title}mail</h1>
        <p className="mt-1 max-w-2xl text-body-sm text-muted">
          Beschikbare velden: {entry.tokens.map((token) => `{${token}}`).join(", ")}
        </p>
      </div>

      <div className="mt-6">
        <BusinessLifecycleEmailForm kind={rawKind} initialContent={content} />
      </div>
    </div>
  );
}
