import "server-only";

// Exchange rates from the European Central Bank's daily reference rates (free, no key).
// A rate is "units of the currency per 1 euro"; the rate of the invoice date is used,
// or the last published rate before it (weekends and holidays have none).

export const SUPPORTED_FOREIGN_CURRENCIES = ["USD"] as const;
export type ForeignCurrency = (typeof SUPPORTED_FOREIGN_CURRENCIES)[number];

export class ExchangeRateError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 502) {
    super(message);
    this.name = "ExchangeRateError";
  }
}

export type EurRate = { currency: ForeignCurrency; rate: number; rateDate: string };

const RECENT_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml";
const FULL_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml";
const CACHE_MS = 3 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; rates: Map<string, number> }>();

export function isForeignCurrency(value: string): value is ForeignCurrency {
  return (SUPPORTED_FOREIGN_CURRENCIES as readonly string[]).includes(value.toUpperCase());
}

/** Parses the ECB XML into date → rate for one currency. */
export function parseEcbRates(xml: string, currency: ForeignCurrency): Map<string, number> {
  const rates = new Map<string, number>();
  const dayPattern = /<Cube time="(\d{4}-\d{2}-\d{2})">([\s\S]*?)<\/Cube>/gu;
  const ratePattern = new RegExp(`<Cube currency="${currency}" rate="([0-9.]+)"\\s*/>`, "u");
  for (const day of xml.matchAll(dayPattern)) {
    const match = day[2].match(ratePattern);
    if (match) rates.set(day[1], Number(match[1]));
  }
  return rates;
}

async function ratesFrom(url: string, currency: ForeignCurrency, fetchImpl: typeof fetch): Promise<Map<string, number>> {
  const key = `${url}|${currency}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.rates;
  let response: Response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
  } catch {
    throw new ExchangeRateError("ECB_UNREACHABLE", "De wisselkoers van de ECB kon niet worden opgehaald. Probeer het zo opnieuw.", 503);
  }
  if (!response.ok) throw new ExchangeRateError("ECB_UNREACHABLE", "De wisselkoers van de ECB kon niet worden opgehaald. Probeer het zo opnieuw.", 503);
  const rates = parseEcbRates(await response.text(), currency);
  if (!rates.size) throw new ExchangeRateError("ECB_EMPTY", "De ECB gaf geen wisselkoers terug.", 502);
  cache.set(key, { at: Date.now(), rates });
  return rates;
}

function rateOnOrBefore(rates: Map<string, number>, date: string): { rate: number; rateDate: string } | null {
  let best: string | null = null;
  for (const day of rates.keys()) if (day <= date && (!best || day > best)) best = day;
  return best ? { rate: rates.get(best)!, rateDate: best } : null;
}

/** The ECB rate (currency per euro) for a date, YYYY-MM-DD. */
export async function eurRateFor(currency: ForeignCurrency, date: string, fetchImpl: typeof fetch = fetch): Promise<EurRate> {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new ExchangeRateError("INVALID_DATE", "Ongeldige datum voor de wisselkoers.", 422);
  const recent = await ratesFrom(RECENT_URL, currency, fetchImpl);
  const oldestRecent = [...recent.keys()].sort()[0];
  const found = date >= oldestRecent ? rateOnOrBefore(recent, date) : rateOnOrBefore(await ratesFrom(FULL_URL, currency, fetchImpl), date);
  if (!found) throw new ExchangeRateError("NO_RATE", `Er is geen ECB-koers voor ${currency} op of voor ${date}.`, 422);
  return { currency, ...found };
}

/** Converts an amount in cents of the foreign currency to euro cents. */
export function toEuroCents(foreignCents: number, rate: number): number {
  return Math.round(foreignCents / rate);
}

/** Test hook. */
export function clearExchangeRateCache() {
  cache.clear();
}
