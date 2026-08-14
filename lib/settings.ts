import { prisma } from "@/lib/prisma";

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function getSettings(keys: string[]): Promise<Record<string, string | null>> {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: keys } } });
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  return Object.fromEntries(keys.map((key) => [key, byKey.get(key) ?? null]));
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
