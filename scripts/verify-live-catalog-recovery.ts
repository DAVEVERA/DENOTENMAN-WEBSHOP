import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sitemapArgument = process.argv.find((value) => value.startsWith("--sitemap="))?.slice("--sitemap=".length);
const reportArgument = process.argv.find((value) => value.startsWith("--report="))?.slice("--report=".length);

async function main() {
if (!sitemapArgument) throw new Error("--sitemap ontbreekt.");

const sitemap = await readFile(resolve(process.cwd(), sitemapArgument), "utf8");
const urls = [...new Set(
  [...sitemap.matchAll(/<loc>(https:\/\/denotenman\.com\/nl\/producten\/[^<]+)<\/loc>/g)].map((match) => match[1]),
)];
const results: Array<{ url: string; status: number; error?: string }> = [];
let cursor = 0;

async function worker() {
  while (cursor < urls.length) {
    const url = urls[cursor++];
    try {
      const response = await fetch(`${url}?recovery_check=20260821`, {
        redirect: "follow",
        headers: { "cache-control": "no-cache", "user-agent": "MNRV recovery verification" },
      });
      results.push({ url, status: response.status });
    } catch (error) {
      results.push({ url, status: 0, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

await Promise.all(Array.from({ length: 12 }, () => worker()));
results.sort((left, right) => left.url.localeCompare(right.url));

const keyChecks = [
  { path: "/nl/producten/agave-siroop-licht-mild", name: "Agave siroop Licht & Mild", price: "5,00" },
  { path: "/nl/producten/dadelstroop", name: "Dadelstroop", price: "4,50" },
  { path: "/nl/producten/iran-dadel", name: "Iran Dadels", price: "4,50" },
  { path: "/nl/producten/walnootstukjes-klein", name: "Walnootstukjes Klein", price: "8,50" },
  { path: "/nl/producten/nuts-today-medjoul-dadels", name: "Nuts Today Medjoul Dadels", price: "10,00" },
  { path: "/nl/producten/chocolade-notenmix", name: "Chocolade Notenmix", price: "4,50" },
  { path: "/nl/producten/acaciahoning", name: "Acaciahoning", price: "7,00" },
];

const keyResults = await Promise.all(keyChecks.map(async (check) => {
  const response = await fetch(`https://denotenman.com${check.path}?recovery_check=20260821`, {
    redirect: "follow",
    headers: { "cache-control": "no-cache", "user-agent": "MNRV recovery verification" },
  });
  const body = await response.text();
  return {
    ...check,
    status: response.status,
    hasName: body.includes(check.name),
    hasPrice: body.includes(check.price),
  };
}));

const hiddenResponse = await fetch("https://denotenman.com/nl/producten/kleine-gele-rozijnen?recovery_check=20260821", {
  redirect: "follow",
  headers: { "cache-control": "no-cache", "user-agent": "MNRV recovery verification" },
});

const report = {
  generatedAt: new Date().toISOString(),
  oldRoutes: {
    total: results.length,
    status200: results.filter((result) => result.status === 200).length,
    status404: results.filter((result) => result.status === 404).length,
    other: results.filter((result) => result.status !== 200 && result.status !== 404).length,
    failures: results.filter((result) => result.status !== 200),
  },
  keyResults,
  intentionallyHidden: { path: "/nl/producten/kleine-gele-rozijnen", status: hiddenResponse.status },
};

if (reportArgument) await writeFile(resolve(process.cwd(), reportArgument), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));

if (keyResults.some((result) => result.status !== 200 || !result.hasName || !result.hasPrice)) process.exitCode = 1;
if (hiddenResponse.status !== 404) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
