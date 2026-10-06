import { z } from "zod";

export const geminiImageModelIds = ["gemini-3.1-flash-image", "gemini-3-pro-image"] as const;
export const geminiImagePresets = ["catalog", "editorial", "lifestyle", "seasonal", "social", "hero"] as const;
export const geminiImageAspectRatios = ["1:1", "4:5", "16:9", "9:16"] as const;
export const geminiImageSizes = ["1K", "2K"] as const;

export const geminiImageJobSchema = z.object({
  productId: z.string().trim().min(1).max(100),
  imageId: z.string().trim().min(1).max(100),
  modelId: z.enum(geminiImageModelIds),
  preset: z.enum(geminiImagePresets),
  aspectRatio: z.enum(geminiImageAspectRatios),
  imageSize: z.enum(geminiImageSizes),
  brief: z.string().trim().max(800),
});

export type GeminiImageJobInput = z.infer<typeof geminiImageJobSchema>;

export const geminiImageModels = [
  {
    id: "gemini-3.1-flash-image",
    name: "Gemini Flash",
    description: "Snel en geschikt voor dagelijkse productfoto's, socials en banners.",
    priceHint: "Richtprijs Google: circa $0,067 per 1K-beeld",
  },
  {
    id: "gemini-3-pro-image",
    name: "Gemini Pro",
    description: "Premium kwaliteit voor complexe composities en belangrijke campagnes.",
    priceHint: "Richtprijs Google: circa $0,134 per 1K/2K-beeld",
  },
] as const satisfies ReadonlyArray<{
  id: GeminiImageJobInput["modelId"];
  name: string;
  description: string;
  priceHint: string;
}>;
