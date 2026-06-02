export const MOLLIE_API_BASE_URL = "https://api.mollie.com/v2";

export type MollieClientConfig = {
  apiKey: string;
  apiBaseUrl?: string;
};

export type MollieMoney = {
  currency: "EUR";
  value: string;
};

export type MolliePayment = {
  id: string;
  status: string;
  amount: MollieMoney;
  description: string;
  redirectUrl?: string;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
  _links?: {
    checkout?: {
      href: string;
      type?: string;
    };
  };
};

export function createMollieClient(config: MollieClientConfig) {
  if (!config.apiKey) {
    throw new Error("Mollie API key ontbreekt.");
  }

  const apiBaseUrl = config.apiBaseUrl ?? MOLLIE_API_BASE_URL;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Mollie API error ${response.status}: ${body}`);
    }

    return (await response.json()) as T;
  }

  return {
    get<T>(path: string) {
      return request<T>(path, { method: "GET" });
    },
    post<T>(path: string, body: unknown) {
      return request<T>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
  };
}

export function centsToMollieValue(cents: number) {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error("Mollie bedrag is ongeldig.");
  }

  return (cents / 100).toFixed(2);
}
