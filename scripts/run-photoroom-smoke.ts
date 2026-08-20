import { randomUUID } from "node:crypto";
import { createPhotoRoomDraft } from "../lib/design-studio/service";
import { prisma } from "../lib/prisma";

function argumentValue(name: string): string | null {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1).trim() || null;
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() || null : null;
}

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

async function main() {
  if (!process.argv.includes("--confirm-live")) {
    throw new Error("Deze smoke-test doet exact één echte providercall. Gebruik expliciet --confirm-live.");
  }
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    throw new Error("TLS-certificaatcontrole is uitgeschakeld; de providercall is veilig afgebroken.");
  }
  if (!process.env.PHOTOROOM_API_KEY?.trim()) throw new Error("PHOTOROOM_API_KEY ontbreekt.");

  const productId = argumentValue("--product-id");
  const imageId = argumentValue("--image-id");
  if ((productId && !imageId) || (!productId && imageId)) {
    throw new Error("Geef --product-id en --image-id samen op, of laat beide weg.");
  }

  const admin = await prisma.adminUser.findFirst({
    where: { active: true, role: { in: ["OWNER", "ADMIN"] } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (!admin) throw new Error("Geen actieve OWNER of ADMIN gevonden.");

  const source = productId && imageId
    ? await prisma.productImage.findFirst({
      where: { id: imageId, productId, product: { isActive: true } },
      select: { id: true, productId: true },
    })
    : await prisma.productImage.findFirst({
      where: { product: { isActive: true } },
      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, productId: true },
    });
  if (!source) throw new Error("Geen geldige actieve bronafbeelding gevonden.");

  const dayKey = amsterdamDayKey();
  const before = await prisma.designProviderUsage.findUnique({
    where: { dayKey_provider: { dayKey, provider: "PHOTOROOM" } },
    select: { attempts: true },
  });
  if ((before?.attempts ?? 0) >= 25) throw new Error("De dagelijkse PhotoRoom-limiet is al bereikt; er is geen call gedaan.");

  const result = await createPhotoRoomDraft({
    adminUserId: admin.id,
    idempotencyKey: `photoroom-live-smoke-${randomUUID()}`,
    options: {
      productId: source.productId,
      imageId: source.id,
      background: "white",
      format: "square",
      padding: 0.1,
      softShadow: false,
    },
  });

  const [job, asset, usage] = await Promise.all([
    prisma.designJob.findUnique({ where: { id: result.jobId }, select: { status: true } }),
    prisma.designAsset.findUnique({
      where: { id: result.asset.id },
      select: { status: true, productImageId: true, productId: true, sourceImageId: true, fileSize: true, width: true, height: true },
    }),
    prisma.designProviderUsage.findUnique({
      where: { dayKey_provider: { dayKey, provider: "PHOTOROOM" } },
      select: { attempts: true },
    }),
  ]);

  if (!job || job.status !== "SUCCEEDED") throw new Error("De DesignJob is niet veilig als SUCCEEDED vastgelegd.");
  if (!asset || asset.status !== "DRAFT" || asset.productImageId !== null) {
    throw new Error("Het resultaat is niet uitsluitend als DRAFT-asset vastgelegd.");
  }
  if (asset.productId !== source.productId || asset.sourceImageId !== source.id || asset.fileSize <= 0 || asset.width <= 0 || asset.height <= 0) {
    throw new Error("De opgeslagen DRAFT-metadata is ongeldig.");
  }
  if (!usage || usage.attempts !== (before?.attempts ?? 0) + 1) {
    throw new Error("De transactionele dagcounter is niet exact één keer verhoogd.");
  }

  console.log(JSON.stringify({
    jobId: result.jobId,
    assetId: result.asset.id,
    productId: source.productId,
    sourceImageId: source.id,
    jobStatus: job.status,
    assetStatus: asset.status,
    productImageId: asset.productImageId,
    attemptsUsedToday: usage.attempts,
    dailyLimit: result.dailyLimit,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "PhotoRoom-smoke-test mislukt.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
