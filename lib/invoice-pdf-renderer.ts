import "server-only";
import type { Browser } from "playwright";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import("playwright");
      return chromium.launch({ headless: true });
    })();
  }
  return browserPromise;
}

export async function renderHtmlToPdfBase64(html: string): Promise<string> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle" });
    const bytes = await page.pdf({ format: "A4", printBackground: true });
    return bytes.toString("base64");
  } finally {
    await page.close();
  }
}
