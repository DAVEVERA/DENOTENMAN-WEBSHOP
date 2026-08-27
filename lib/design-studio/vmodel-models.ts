export const vModelModelIds = ["nano-banana-2", "nano-banana-pro", "seedream-4-5"] as const;

export type VModelModelId = (typeof vModelModelIds)[number];
export type VModelQuality = "standard" | "high";

export type VModelDescriptor = {
  id: VModelModelId;
  name: string;
  description: string;
  bestFor: string;
  priceHint: string;
  version: string;
  createEndpoint: string;
  imageInputField: "img_urls" | "image_input";
  qualityValues: Record<VModelQuality, "1K" | "2K" | "4K">;
};

export const vModelModels: readonly VModelDescriptor[] = [
  {
    id: "nano-banana-2",
    name: "Nano Banana 2",
    description: "Snel verkoopbeeld met sterke product- en compositieherkenning.",
    bestFor: "Dagelijkse socials en campagnevarianten",
    priceHint: "vanaf $0,03 per beeld",
    version: "81df2e08a1d61b48f96ca1073fdd8dc68ca68be156e42a7e86c0534a94099a04",
    createEndpoint: "https://api.vmodel.ai/api/tasks/v1/create",
    imageInputField: "img_urls",
    qualityValues: { standard: "1K", high: "2K" },
  },
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    description: "Meer controle over detail, merkuitstraling en leesbare composities.",
    bestFor: "Campagnehoofbeelden en merkwerk",
    priceHint: "vanaf $0,0335 per beeld",
    version: "3fdd8dc68ca68be11df2e56053a0448f94a94099808a1d61be42a7e86c6ca107",
    createEndpoint: "https://api.vmodel.ai/api/tasks/v1/create",
    imageInputField: "img_urls",
    qualityValues: { standard: "1K", high: "2K" },
  },
  {
    id: "seedream-4-5",
    name: "Seedream 4.5",
    description: "Sterke artdirection voor rijkere, fotografische productscènes.",
    bestFor: "Editorial, seizoensbeelden en grote banners",
    priceHint: "circa $0,028 per beeld",
    version: "4ce713043ea0275271d7b65741005f5489b1218c4dfc012cc06763654a92a0aa",
    createEndpoint: "https://api.vmodel.ai/api/tasks/v1/bytedance/seedream-4-5/create",
    imageInputField: "image_input",
    qualityValues: { standard: "2K", high: "4K" },
  },
] as const;

export function getVModelDescriptor(id: VModelModelId): VModelDescriptor {
  const model = vModelModels.find((candidate) => candidate.id === id);
  if (!model) throw new Error(`Onbekend VModel-model: ${id}`);
  return model;
}
