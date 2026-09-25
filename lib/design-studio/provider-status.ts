import "server-only";

import { prisma } from "@/lib/prisma";
import { getPhotoRoomAvailability } from "@/lib/design-studio/photoroom-provider";
import { isCopywriterGeminiConfigured } from "@/lib/design-studio/copywriter/gemini-provider";
import type { PhotoRoomAvailability } from "@/lib/design-studio/types";

// These limits mirror the per-provider daily caps enforced in
// lib/design-studio/service.ts (PhotoRoom) and lib/design-studio/vmodel-service.ts (VModel).
// They are duplicated here (read-only, for the hub status display) rather than imported so
// this module never has to touch provider job logic.
const PHOTOROOM_DAILY_LIMIT = 25;
const VMODEL_DAILY_LIMIT = 25;

function amsterdamDayKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export type PhotoRoomModuleStatus = {
  provider: "photoroom";
  availability: PhotoRoomAvailability;
  dailyLimit: number;
};

export type VModelModuleStatus = {
  provider: "vmodel";
  configured: boolean;
  attemptsUsed: number;
  dailyLimit: number;
};

export type CopywriterModuleStatus = {
  provider: "copywriter";
  configured: boolean;
};

export type DesignStudioProviderStatuses = {
  photoroom: PhotoRoomModuleStatus;
  vmodel: VModelModuleStatus;
  copywriter: CopywriterModuleStatus;
};

export async function getDesignStudioProviderStatuses(): Promise<DesignStudioProviderStatuses> {
  const vmodelConfigured = Boolean(process.env.VMODEL_API_KEY?.trim());
  const [availability, usage] = await Promise.all([
    getPhotoRoomAvailability(),
    vmodelConfigured
      ? prisma.designProviderUsage.findUnique({
          where: { dayKey_provider: { dayKey: amsterdamDayKey(), provider: "VMODEL" } },
          select: { attempts: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    photoroom: { provider: "photoroom", availability, dailyLimit: PHOTOROOM_DAILY_LIMIT },
    vmodel: {
      provider: "vmodel",
      configured: vmodelConfigured,
      attemptsUsed: usage?.attempts ?? 0,
      dailyLimit: VMODEL_DAILY_LIMIT,
    },
    copywriter: { provider: "copywriter", configured: isCopywriterGeminiConfigured() },
  };
}
