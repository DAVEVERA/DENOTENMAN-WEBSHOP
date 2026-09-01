import "server-only";

export interface PeppolSendInput {
  invoicePdfBase64: string;
  invoiceNumber: string;
  recipientParticipantId: string;
}

export interface PeppolSendResult {
  messageId: string;
}

export interface PeppolAdapter {
  send(input: PeppolSendInput): Promise<PeppolSendResult>;
}

export class PeppolNotConfiguredError extends Error {
  constructor() {
    super("Peppol-verzending is nog niet geconfigureerd voor dit account.");
    this.name = "PeppolNotConfiguredError";
  }
}

/**
 * No Peppol Access Point provider has been chosen yet. Rather than block the
 * rest of the invoicing flow on that vendor decision, every account defaults
 * to this adapter, which always reports "not configured" — the UI shows an
 * honest "coming soon" state instead of a button that does nothing.
 */
class NoopPeppolAdapter implements PeppolAdapter {
  async send(): Promise<PeppolSendResult> {
    throw new PeppolNotConfiguredError();
  }
}

export function getPeppolAdapter(): PeppolAdapter {
  const provider = process.env.PEPPOL_PROVIDER?.trim().toLowerCase();
  switch (provider) {
    case undefined:
    case "":
    case "none":
      return new NoopPeppolAdapter();
    default:
      // A real provider (e.g. Storecove) integration lands here once chosen.
      console.warn(`Unknown PEPPOL_PROVIDER "${provider}"; falling back to the no-op adapter.`);
      return new NoopPeppolAdapter();
  }
}
