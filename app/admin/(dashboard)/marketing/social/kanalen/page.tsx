/* eslint-disable @next/next/no-img-element -- account avatars come from the platforms' own CDNs. */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, CheckCircle2, Link2, TriangleAlert } from "lucide-react";

import { DisconnectAccountButton } from "@/components/admin-panel/social/DisconnectAccountButton";
import { PlatformIcon } from "@/components/admin-panel/social/PlatformIcon";
import { requireAdminPage } from "@/lib/developer-portal/page-auth";
import { prisma } from "@/lib/prisma";
import { socialRedirectUri } from "@/lib/social/http";
import { connectionStatus, SOCIAL_CONNECTIONS } from "@/lib/social/providers";
import { listSocialAccounts } from "@/lib/social/service";

export const metadata: Metadata = { title: "Social kanalen", robots: { index: false, follow: false } };

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-button px-4 font-heading text-body-sm font-bold transition-colors";

const setupSteps: Record<string, string[]> = {
  meta: [
    "Maak op developers.facebook.com een app van het type Business en voeg Facebook Login for Business en de Instagram Graph API toe.",
    "Koppel het Instagram-account van De Notenman als professioneel account aan de Facebook-pagina.",
    "Zolang de app in ontwikkelmodus staat, werkt koppelen voor beheerders van de app. Voor livegang vraagt Meta een app-review voor pages_manage_posts en instagram_content_publish.",
  ],
  tiktok: [
    "Maak op developers.tiktok.com een app met Login Kit en de Content Posting API (Direct Post).",
    "Tot TikTok de app heeft beoordeeld, worden video's alleen privé geplaatst.",
  ],
  youtube: [
    "Maak in Google Cloud een OAuth-client (webapplicatie) en zet de YouTube Data API v3 aan.",
    "Tot Google de app heeft geverifieerd, blijven geüploade video's privé.",
  ],
};

export default async function SocialChannelsPage({ searchParams }: { searchParams: Promise<{ verbonden?: string; fout?: string }> }) {
  await connection();
  const { adminUserId } = await requireAdminPage();
  const { verbonden, fout } = await searchParams;
  const [admin, accounts] = await Promise.all([
    prisma.adminUser.findUnique({ where: { id: adminUserId }, select: { role: true } }),
    listSocialAccounts(),
  ]);
  const canWrite = admin?.role === "OWNER" || admin?.role === "ADMIN";

  return (
    <div>
      <Link href="/admin/marketing/kalender" className="inline-flex min-h-11 items-center gap-2 text-body-sm font-semibold text-accent-ink underline-offset-4 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Marketingkalender</Link>
      <h1 className="mt-2 text-heading-lg text-text sm:text-heading-xl">Social kanalen</h1>
      <p className="mt-1 max-w-3xl text-body-sm text-muted">Koppel de accounts van De Notenman. Toegangssleutels worden versleuteld opgeslagen en alleen gebruikt om berichten te plaatsen.</p>

      {verbonden ? <p role="status" className="mt-4 flex items-center gap-2 rounded-card border border-green-200 bg-green-50 p-3 text-body-sm font-semibold text-green-800"><CheckCircle2 className="h-5 w-5" aria-hidden="true" />Gekoppeld: {verbonden}</p> : null}
      {fout ? <p role="alert" className="mt-4 flex items-center gap-2 rounded-card border border-red-200 bg-red-50 p-3 text-body-sm font-semibold text-red-800"><TriangleAlert className="h-5 w-5" aria-hidden="true" />{fout}</p> : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {SOCIAL_CONNECTIONS.map((item) => {
          const status = connectionStatus(item);
          const linked = accounts.filter((account) => item.platforms.includes(account.platform));
          return (
            <section key={item.key} className="grid content-start gap-3 rounded-panel border border-border bg-surface p-4 shadow-card sm:p-5" aria-labelledby={`channel-${item.key}`}>
              <h2 id={`channel-${item.key}`} className="flex items-center gap-2 font-heading text-heading-sm font-bold text-text">
                {item.platforms.map((platform) => <PlatformIcon key={platform} platform={platform} />)}{item.label}
              </h2>

              {linked.length ? (
                <ul className="grid gap-2">
                  {linked.map((account) => (
                    <li key={account.id} className="grid gap-2 rounded-card border border-border bg-background p-3">
                      <div className="flex items-center gap-2">
                        {account.avatarUrl ? <img src={account.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" /> : <PlatformIcon platform={account.platform} />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-text">{account.displayName}</span>
                          <span className={`block text-xs ${account.status === "CONNECTED" ? "text-green-800" : "text-red-700"}`}>{account.status === "CONNECTED" ? "Gekoppeld" : "Opnieuw koppelen nodig"}</span>
                        </span>
                      </div>
                      {account.lastError ? <p className="text-xs text-red-700">{account.lastError}</p> : null}
                      {canWrite ? <DisconnectAccountButton accountId={account.id} name={account.displayName} /> : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-body-sm text-muted">Nog niet gekoppeld.</p>}

              {status.configured ? (
                canWrite ? <a href={`/api/admin/social/connect/${item.key}`} className={`${buttonClass} bg-accent text-contrast`}><Link2 className="h-4 w-4" aria-hidden="true" />{linked.length ? "Opnieuw koppelen of toevoegen" : `Koppel ${item.label}`}</a> : null
              ) : (
                <div className="grid gap-2 rounded-card border border-amber-300 bg-amber-50 p-3 text-body-sm text-amber-900">
                  <p className="font-semibold">Nog niet ingesteld op de server.</p>
                  <ol className="grid list-decimal gap-1 pl-5">
                    {setupSteps[item.key].map((step) => <li key={step}>{step}</li>)}
                    <li>Zet als redirect-URL: <code className="break-all rounded bg-surface px-1">{socialRedirectUri(item.key)}</code></li>
                    <li>Zet deze variabelen op de server: {status.missingEnv.map((name) => <code key={name} className="mr-1 rounded bg-surface px-1">{name}</code>)}</li>
                  </ol>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
