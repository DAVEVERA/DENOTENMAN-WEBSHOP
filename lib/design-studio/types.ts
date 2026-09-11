export type DesignAssetDto = {
  id: string;
  jobId: string;
  productId: string;
  sourceImageId: string;
  url: string;
  width: number;
  height: number;
  fileSize: number;
  status: "DRAFT" | "PUBLISHED" | "DISCARDED";
  productImageId: string | null;
  createdAt: string;
};

export type DesignStudioProduct = {
  id: string;
  name: string;
  images: Array<{
    id: string;
    url: string;
    alt: string | null;
    isPrimary: boolean;
    sortOrder: number;
  }>;
};

export type PhotoRoomAvailability = {
  status: "ready" | "insufficient_credits" | "not_configured" | "invalid_configuration" | "unavailable";
  availableCredits: number | null;
  requiredCredits: number | null;
};
