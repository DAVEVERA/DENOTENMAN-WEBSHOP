export type PriceMonitorSourceDefinition = {
  key: "noten-nl" | "bas-boer";
  name: string;
  baseUrl: string;
  adapterKey: string;
  status: "READY" | "NEEDS_SETUP" | "PAUSED";
  statusLabel: string;
  statusNote: string;
  canRun: boolean;
};

export const PRICE_MONITOR_SOURCES: readonly PriceMonitorSourceDefinition[] = [
  {
    key: "noten-nl",
    name: "Noten.nl",
    baseUrl: "https://www.noten.nl",
    adapterKey: "noten-nl-v1",
    status: "READY",
    statusLabel: "Klaar voor proefrun",
    statusNote:
      "Noten.nl heeft een begrensde sitemap-adapter in de prijsmonitor. Start eerst met maximaal 25 producten.",
    canRun: true,
  },
  {
    key: "bas-boer",
    name: "Bas Boer Noten",
    baseUrl: "https://www.basboernoten.nl",
    adapterKey: "bas-boer-v1",
    status: "READY",
    statusLabel: "Klaar voor proefrun",
    statusNote:
      "Bas Boer Noten heeft een begrensde koppeling met rustige verzoeken. Start met maximaal 25 producten en probeer later opnieuw als de bron tijdelijk afremt.",
    canRun: true,
  },
] as const;

export function getPriceMonitorSource(key: string): PriceMonitorSourceDefinition | null {
  return PRICE_MONITOR_SOURCES.find((source) => source.key === key) || null;
}
