import { Prisma } from "@prisma/client";

export function isAftersalesSchemaUnavailable(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2021") {
    return false;
  }

  const modelName = String(error.meta?.modelName ?? "");
  const table = String(error.meta?.table ?? "");
  return modelName.startsWith("Aftersales") || table.includes("Aftersales");
}
