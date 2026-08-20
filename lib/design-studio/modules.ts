export type DesignStudioModule = {
  id: string;
  title: string;
  description: string;
  href: string;
  status: "ACTIVE" | "PLANNED";
  provider?: "PhotoRoom";
};

export const designStudioModules: readonly DesignStudioModule[] = [
  {
    id: "product-photos",
    title: "Productfoto’s",
    description: "Maak consistente uitsneden en achtergronden zonder het origineel te overschrijven.",
    href: "/admin/design-studio/productfotos",
    status: "ACTIVE",
    provider: "PhotoRoom",
  },
  {
    id: "campaign-assets",
    title: "Campagnebeelden",
    description: "Herbruikbare composities voor banners en acties.",
    href: "/admin/design-studio/campagnebeelden",
    status: "PLANNED",
  },
  {
    id: "labels",
    title: "Labels en drukwerk",
    description: "Vaste merktemplates voor labels, kaarten en verpakkingen.",
    href: "/admin/design-studio/labels",
    status: "PLANNED",
  },
] as const;
