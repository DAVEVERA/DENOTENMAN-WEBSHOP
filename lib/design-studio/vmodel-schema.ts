import { z } from "zod";
import { vModelModelIds } from "@/lib/design-studio/vmodel-models";
import type { DesignAssetDto } from "@/lib/design-studio/types";

export const vModelPresets = ["editorial", "lifestyle", "seasonal", "social", "hero"] as const;
export const vModelAspectRatios = ["1:1", "4:5", "16:9", "9:16"] as const;
export const vModelQualities = ["standard", "high"] as const;

export const vModelJobSchema = z.object({
  productId: z.string().trim().min(1).max(100),
  imageId: z.string().trim().min(1).max(100),
  modelId: z.enum(vModelModelIds),
  preset: z.enum(vModelPresets),
  aspectRatio: z.enum(vModelAspectRatios),
  quality: z.enum(vModelQualities),
  brief: z.string().trim().max(800),
});

export type VModelJobInput = z.infer<typeof vModelJobSchema>;
export type VModelJobStatus = "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED";

export type VModelJobDto = {
  id: string;
  productId: string;
  sourceImageId: string;
  status: VModelJobStatus;
  modelId: VModelJobInput["modelId"];
  asset: DesignAssetDto | null;
  errorMessage: string | null;
  createdAt: string;
};
