export type DesignStudioModule = {
  id: string;
  title: string;
  description: string;
  href: string;
  status: "ACTIVE" | "PLANNED";
  provider?: "PhotoRoom" | "VModel" | "Gemini";
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
    description: "Maak productgetrouwe scenes voor banners, socials en seizoensacties.",
    href: "/admin/design-studio/campagnebeelden",
    status: "ACTIVE",
    provider: "VModel",
  },
  {
    id: "labels",
    title: "Labels en drukwerk",
    description: "Vaste merktemplates voor labels, kaarten en verpakkingen.",
    href: "/admin/design-studio/labels",
    status: "PLANNED",
  },
  {
    id: "copywriter",
    title: "De Notenman CopyWriter",
    description: "Controleer productteksten en pas alleen expliciet gekozen verbeteringen toe.",
    href: "/admin/design-studio/copywriter",
    status: "ACTIVE",
    provider: "Gemini",
  },
] as const;
