import "server-only";

import { prisma } from "@/lib/prisma";
import { getPhotoRoomAvailability } from "@/lib/design-studio/photoroom-provider";
import { getVModelAvailability } from "@/lib/design-studio/vmodel-provider";
import { getGeminiImageAvailability } from "@/lib/design-studio/gemini-image-provider";
import { isCopywriterGeminiConfigured } from "@/lib/design-studio/copywriter/gemini-provider";
import type { GeminiImageAvailability, PhotoRoomAvailability, VModelAvailability } from "@/lib/design-studio/types";

// These limits mirror the per-provider daily caps enforced in
// lib/design-studio/service.ts (PhotoRoom) and lib/design-studio/vmodel-service.ts (VModel).
// They are duplicated here (read-only, for the hub status display) rather than imported so
// this module never has to touch provider job logic.
const PHOTOROOM_DAILY_LIMIT = 25;
const VMODEL_DAILY_LIMIT = 25;
const GEMINI_DAILY_LIMIT = 25;

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
  availability: VModelAvailability;
  attemptsUsed: number;
  dailyLimit: number;
};

export type CopywriterModuleStatus = {
  provider: "copywriter";
  configured: boolean;
};

export type GeminiImageModuleStatus = {
  provider: "gemini";
  configured: boolean;
  availability: GeminiImageAvailability;
  attemptsUsed: number;
  dailyLimit: number;
};

export type DesignStudioProviderStatuses = {
  photoroom: PhotoRoomModuleStatus;
  vmodel: VModelModuleStatus;
  geminiImage: GeminiImageModuleStatus;
  copywriter: CopywriterModuleStatus;
};

export async function getDesignStudioProviderStatuses(): Promise<DesignStudioProviderStatuses> {
  const vmodelConfigured = Boolean(process.env.VMODEL_API_KEY?.trim());
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim()) && process.env.GEMINI_API_KEY?.trim() !== "MY_GEMINI_API_KEY";
  const [availability, vmodelAvailability, geminiAvailability, vmodelUsage, geminiUsage] = await Promise.all([
    getPhotoRoomAvailability(),
    getVModelAvailability(),
    getGeminiImageAvailability(),
    vmodelConfigured
      ? prisma.designProviderUsage.findUnique({
          where: { dayKey_provider: { dayKey: amsterdamDayKey(), provider: "VMODEL" } },
          select: { attempts: true },
        })
      : Promise.resolve(null),
    geminiConfigured
      ? prisma.designProviderUsage.findUnique({
          where: { dayKey_provider: { dayKey: amsterdamDayKey(), provider: "GEMINI" } },
          select: { attempts: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    photoroom: { provider: "photoroom", availability, dailyLimit: PHOTOROOM_DAILY_LIMIT },
    vmodel: {
      provider: "vmodel",
      configured: vmodelConfigured,
      availability: vmodelAvailability,
      attemptsUsed: vmodelUsage?.attempts ?? 0,
      dailyLimit: VMODEL_DAILY_LIMIT,
    },
    geminiImage: {
      provider: "gemini",
      configured: geminiConfigured,
      availability: geminiAvailability,
      attemptsUsed: geminiUsage?.attempts ?? 0,
      dailyLimit: GEMINI_DAILY_LIMIT,
    },
    copywriter: { provider: "copywriter", configured: isCopywriterGeminiConfigured() },
  };
}
