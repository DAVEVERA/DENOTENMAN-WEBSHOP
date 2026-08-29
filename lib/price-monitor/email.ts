import "server-only";

import { sendAftersalesMail } from "@/lib/aftersales/provider";
import { prisma } from "@/lib/prisma";
import { BASE_URL } from "@/lib/routes";
import { nextPriceReportRun } from "@/lib/price-monitor/schedule";
import { getPriceMonitorDashboard } from "@/lib/price-monitor/service";

export async function sendDuePriceMonitorReports(now = new Date()): Promise<{
  checked: number;
  sent: number;
  failed: number;
}> {
  const schedules = await prisma.priceMonitorReportSchedule.findMany({
    where: { enabled: true, nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
    take: 10,
  });
  if (!schedules.length) return { checked: 0, sent: 0, failed: 0 };
  const dashboard = await getPriceMonitorDashboard();
  let checked = 0;
  let sent = 0;
  let failed = 0;
  for (const schedule of schedules) {
    const claim = await prisma.priceMonitorReportSchedule.updateMany({
      where: {
        id: schedule.id,
        enabled: true,
        nextRunAt: { lte: now },
        OR: [
          { lastStatus: { not: "PROCESSING" } },
          { lastRunAt: null },
          { lastRunAt: { lt: new Date(now.getTime() - 30 * 60 * 1000) } },
        ],
      },
      data: { lastStatus: "PROCESSING", lastRunAt: now, lastError: null },
    });
    if (claim.count === 0) continue;
    checked += 1;
    const nextRunAt = nextPriceReportRun(now, schedule);
    if (!schedule.recipientEmail) {
      failed += 1;
      await prisma.priceMonitorReportSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          lastStatus: "FAILED",
          lastError: "Geen ontvanger ingesteld",
          nextRunAt,
        },
      });
      continue;
    }
    try {
      const minimum = schedule.minDifferenceBps;
      const significant = dashboard.comparisons
        .filter((item) => item.safeForAnalysis && Math.abs(item.differenceBps) >= minimum)
        .sort((a, b) => Math.abs(b.differenceBps) - Math.abs(a.differenceBps));
      await sendAftersalesMail({
        deliveryId: `price-report-${schedule.id}-${now.toISOString().slice(0, 10)}`,
        orderId: "price-monitor",
        trigger: "PRICE_MONITOR_REPORT",
        to: schedule.recipientEmail,
        subject: `Prijsmonitor: ${significant.length} opvallende prijsverschillen`,
        html: reportHtml(significant.slice(0, 12), dashboard.summary.averageDataQualityScore),
        text: reportText(significant.slice(0, 12), dashboard.summary.averageDataQualityScore),
      });
      sent += 1;
      await prisma.priceMonitorReportSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          lastSentAt: now,
          lastStatus: "SENT",
          lastError: null,
          nextRunAt,
        },
      });
    } catch (error) {
      failed += 1;
      await prisma.priceMonitorReportSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          lastStatus: "FAILED",
          lastError: error instanceof Error ? error.message.slice(0, 300) : "Onbekende verzendfout",
          nextRunAt,
        },
      });
    }
  }
  return { checked, sent, failed };
}

type ReportItem = Awaited<ReturnType<typeof getPriceMonitorDashboard>>["comparisons"][number];

function reportHtml(items: ReportItem[], averageQuality: number | null): string {
  const rows = items.length
    ? items
        .map(
          (item) => `<tr>
            <td style="padding:10px;border-bottom:1px solid #e4dfd5">${escapeHtml(item.ownProduct)}</td>
            <td style="padding:10px;border-bottom:1px solid #e4dfd5">${escapeHtml(item.competitor)}</td>
            <td style="padding:10px;border-bottom:1px solid #e4dfd5;text-align:right">${formatPercent(item.differenceBps)}</td>
            <td style="padding:10px;border-bottom:1px solid #e4dfd5">${escapeHtml(direction(item.differenceBps))}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="4" style="padding:16px">Geen verschillen boven de ingestelde grens.</td></tr>`;
  return `<!doctype html><html lang="nl"><body style="margin:0;background:#f6f3ee;color:#333;font-family:Arial,sans-serif">
    <main style="max-width:720px;margin:0 auto;padding:28px 18px">
      <p style="font-size:13px;font-weight:700;color:#806600;text-transform:uppercase">De Notenman</p>
      <h1 style="margin:4px 0 8px">Prijsrapport</h1>
      <p>Datakwaliteit: <strong>${averageQuality === null ? "nog niet berekend" : `${averageQuality}%`}</strong>. Controleer productmatch, inkoopprijs en marge voordat je een actie uitvoert.</p>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e4dfd5;border-radius:12px;overflow:hidden">
        <thead><tr><th style="padding:10px;text-align:left">Product</th><th style="padding:10px;text-align:left">Bron</th><th style="padding:10px;text-align:right">Verschil</th><th style="padding:10px;text-align:left">Betekenis</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:20px"><a href="${BASE_URL}/admin/prijsmonitor" style="display:inline-block;background:#e0b200;color:#141414;padding:12px 18px;border-radius:8px;font-weight:700;text-decoration:none">Open de prijsmonitor</a></p>
      <p style="font-size:12px;color:#6e675c">Dit rapport bevat omzet-scenario's, geen winstprognoses. Er wordt vanuit een rapport nooit automatisch een prijs gewijzigd.</p>
    </main></body></html>`;
}

function reportText(items: ReportItem[], averageQuality: number | null): string {
  const lines = items.length
    ? items.map((item) => `- ${item.ownProduct}: ${formatPercent(item.differenceBps)} ${direction(item.differenceBps)} (${item.competitor})`)
    : ["- Geen verschillen boven de ingestelde grens."];
  return [
    "De Notenman prijsmonitor",
    `Datakwaliteit: ${averageQuality === null ? "nog niet berekend" : `${averageQuality}%`}`,
    "",
    ...lines,
    "",
    `Open de prijsmonitor: ${BASE_URL}/admin/prijsmonitor`,
    "Controleer productmatch, inkoopprijs en marge voordat je een actie uitvoert.",
  ].join("\n");
}

function direction(differenceBps: number): string {
  return differenceBps > 0 ? "wij zijn duurder" : "wij zijn goedkoper";
}

function formatPercent(differenceBps: number): string {
  return `${Math.abs(differenceBps / 100).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}%`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
