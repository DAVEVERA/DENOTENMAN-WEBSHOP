import Link from "next/link";
import { prisma } from "@/lib/prisma";

const targetTypeLabels: Record<string, string> = {
  product: "Product",
  category: "Categorie",
  discount: "Kortingsactie",
  whatsapp: "WhatsApp",
  email: "E-mail",
  wifi: "WiFi",
  url: "URL",
  text: "Tekst",
};

export default async function QrCodesPage() {
  const designs = await prisma.qrCodeDesign.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      targetType: true,
      updatedAt: true,
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-heading-xl text-text">QR-codes</h1>
        <Link
          href="/admin/qrcodes/nieuw"
          className="inline-flex min-h-11 items-center rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast shadow-button"
        >
          Nieuwe QR-code
        </Link>
      </div>
      <p className="mt-1 text-body-sm text-muted">
        Maak QR-codes voor producten, categorieën, acties, WiFi, WhatsApp en printbare stickerlabels.
      </p>

      {designs.length === 0 ? (
        <p className="mt-6 text-body-sm text-muted">Nog geen QR-codes aangemaakt.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-panel border border-border bg-surface">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-heading">Naam</th>
                <th className="px-4 py-3 font-heading">Status</th>
                <th className="px-4 py-3 font-heading">Doel</th>
                <th className="px-4 py-3 font-heading">Bijgewerkt</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {designs.map((design) => (
                <tr key={design.id} className="border-b border-border last:border-0 hover:bg-background">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/qrcodes/${design.id}`}
                      className="font-semibold text-text underline-offset-4 hover:underline"
                    >
                      {design.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        design.status === "active"
                          ? "inline-flex items-center rounded-button bg-accent/10 px-2 py-1 text-xs font-semibold text-accent-hover"
                          : "inline-flex items-center rounded-button bg-border px-2 py-1 text-xs font-semibold text-muted"
                      }
                    >
                      {design.status === "active" ? "Actief" : "Gearchiveerd"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {targetTypeLabels[design.targetType] ?? design.targetType}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Intl.DateTimeFormat("nl-NL", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(design.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/qrcodes/${design.id}`}
                      className="font-heading text-body-sm font-semibold text-accent-hover underline underline-offset-4"
                    >
                      Bewerken
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
