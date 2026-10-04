import "server-only";

import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getPhotoRoomAvailability } from "@/lib/design-studio/photoroom-provider";
import { buildProviderStatuses, type IntegrationHealth } from "@/lib/provider-status-core";

const POSTNL_SETTING_KEYS = [
  "postnl.customerCode",
  "postnl.customerNumber",
  "postnl.collectionLocation",
  "postnl.senderName",
  "postnl.senderStreet",
  "postnl.senderHouseNumber",
  "postnl.senderPostalCode",
  "postnl.senderCity",
];

export type ProviderStatusReport = {
  checkedAt: string;
  mode: "read-only";
  statuses: IntegrationHealth[];
};

export async function getProviderStatusReport(): Promise<ProviderStatusReport> {
  const checkedAt = new Date().toISOString();
  const [settings, photoRoom, socialAccounts] = await Promise.all([
    getSettings(POSTNL_SETTING_KEYS),
    // GET /v2/account is PhotoRoom's non-editing account check. It never
    // uploads an image or starts the credit-consuming edit operation.
    getPhotoRoomAvailability(),
    prisma.socialAccount.findMany({
      select: { platform: true, status: true },
      orderBy: [{ platform: "asc" }, { connectedAt: "asc" }],
    }).catch(() => null),
  ]);

  return {
    checkedAt,
    mode: "read-only",
    statuses: buildProviderStatuses({
      environment: process.env,
      settings,
      photoRoom,
      socialAccounts,
    }, checkedAt),
  };
}
