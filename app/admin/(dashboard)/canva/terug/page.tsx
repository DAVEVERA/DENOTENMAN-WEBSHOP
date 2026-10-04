import Link from "next/link";
import { connection } from "next/server";

import { canvaConfig } from "@/lib/canva/config";
import { decodeCorrelation, verifyCanvaReturnToken } from "@/lib/canva/return-token";
import { CanvaReturnImport } from "./CanvaReturnImport";

// Canva sends the editor here after "Return to De Notenman", with a signed token
// that names the design. The design is imported and handed to the field that asked.
export default async function CanvaReturnPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const params = await searchParams;
  const token = typeof params.correlation_jwt === "string" ? params.correlation_jwt : null;
  const config = canvaConfig();
  const verified = token && config ? await verifyCanvaReturnToken(token, config.clientId) : null;

  if (!verified) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="text-heading-xl text-text">Terug uit Canva</h1>
        <p className="mt-4 rounded-panel border border-amber-300 bg-amber-50 p-4 text-body-sm text-amber-900">
          Deze link uit Canva kon niet worden gecontroleerd. Importeer het design via de Canva-knop bij het veld waar je het wilt gebruiken.
        </p>
        <Link href="/admin" className="mt-4 inline-block text-body-sm text-accent-hover underline underline-offset-4">Naar het dashboard</Link>
      </div>
    );
  }

  const correlation = decodeCorrelation(verified.correlationState);
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-heading-xl text-text">Terug uit Canva</h1>
      <CanvaReturnImport designId={verified.designId} returnTo={correlation.returnTo} pickerId={correlation.pickerId} />
    </div>
  );
}
