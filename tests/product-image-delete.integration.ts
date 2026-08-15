import assert from "node:assert/strict";
import { Storage } from "@google-cloud/storage";
import sharp from "sharp";
import { prisma } from "../lib/prisma";
import { deleteProductImage, saveProductImage } from "../lib/storage";

if (!process.env.DATABASE_URL?.includes("localhost:55432")) {
  throw new Error("Refusing image-delete integration test outside the temporary localhost database.");
}

const baseUrl = process.env.IMAGE_DELETE_TEST_BASE_URL ?? "http://localhost:3011";
const bucketName = process.env.GCS_BUCKET;
if (!bucketName) throw new Error("GCS_BUCKET is required for the image-delete integration test.");

const storage = new Storage();
const bucket = storage.bucket(bucketName);

async function main() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const primaryKey = `products/integration-tests/product-image-delete/${suffix}-primary.png`;
  const secondaryKey = `products/integration-tests/product-image-delete/${suffix}-secondary.png`;
  const archiveSuffix = `-${suffix}-primary.png`;
  let productId: string | undefined;

  try {
    const bytes = await sharp({
      create: { width: 32, height: 32, channels: 4, background: "#d8b62b" },
    }).png().toBuffer();
    await Promise.all([
      saveProductImage(primaryKey, bytes, "image/png"),
      saveProductImage(secondaryKey, bytes, "image/png"),
    ]);

    const product = await prisma.product.create({
      data: {
        sku: `IMAGE-DELETE-${suffix}`,
        slug: `image-delete-${suffix}`,
        basePriceCents: 100,
        isActive: false,
        images: {
          create: [
            { storageKey: primaryKey, sortOrder: 0, isPrimary: true, alt: "Primaire testafbeelding" },
            { storageKey: secondaryKey, sortOrder: 1, isPrimary: false, alt: "Secundaire testafbeelding" },
          ],
        },
      },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    });
    productId = product.id;
    const primary = product.images[0];
    assert.ok(primary);

    const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
      }),
    });
    assert.equal(loginResponse.status, 200, await loginResponse.clone().text());
    const cookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0];
    assert.ok(cookie, "Admin login must return a session cookie");

    const deleteResponse = await fetch(
      `${baseUrl}/api/admin/products/${product.id}/images/${primary.id}`,
      { method: "DELETE", headers: { cookie } }
    );
    assert.equal(deleteResponse.status, 200, await deleteResponse.clone().text());
    const body = await deleteResponse.json() as {
      archived: boolean;
      cleanupPending: boolean;
      images: Array<{ id: string; storageKey: string; sortOrder: number; isPrimary: boolean }>;
    };
    assert.equal(body.archived, true);
    assert.equal(body.cleanupPending, false);
    assert.deepEqual(
      body.images.map(({ storageKey, sortOrder, isPrimary }) => ({ storageKey, sortOrder, isPrimary })),
      [{ storageKey: secondaryKey, sortOrder: 0, isPrimary: true }]
    );

    const storedImages = await prisma.productImage.findMany({
      where: { productId: product.id },
      orderBy: { sortOrder: "asc" },
    });
    assert.equal(storedImages.length, 1);
    assert.equal(storedImages[0]?.storageKey, secondaryKey);
    assert.equal(storedImages[0]?.isPrimary, true);
    assert.equal(storedImages[0]?.sortOrder, 0);

    const [primaryExists] = await bucket.file(primaryKey).exists();
    const [secondaryExists] = await bucket.file(secondaryKey).exists();
    const [trashFiles] = await bucket.getFiles({ prefix: "trash/product-images/" });
    assert.equal(primaryExists, false, "The active source object must be removed after archival");
    assert.equal(secondaryExists, true);
    assert.equal(trashFiles.filter((file) => file.name.endsWith(archiveSuffix)).length, 1);

    const trashRows = await prisma.productImageTrash.findMany({ where: { productId: product.id } });
    assert.equal(trashRows.length, 1);
    assert.equal(trashRows[0]?.originalImageId, primary.id);

    const listTrashResponse = await fetch(
      `${baseUrl}/api/admin/products/${product.id}/images/trash`,
      { headers: { cookie } }
    );
    assert.equal(listTrashResponse.status, 200, await listTrashResponse.clone().text());
    const listedTrash = await listTrashResponse.json() as { trash: Array<{ id: string }> };
    assert.equal(listedTrash.trash[0]?.id, trashRows[0]?.id);

    const restoreResponse = await fetch(
      `${baseUrl}/api/admin/products/${product.id}/images/trash/${trashRows[0]?.id}/restore`,
      { method: "POST", headers: { cookie } }
    );
    assert.equal(restoreResponse.status, 200, await restoreResponse.clone().text());
    const restoredBody = await restoreResponse.json() as { image: { storageKey: string; sortOrder: number; isPrimary: boolean } };
    assert.match(restoredBody.image.storageKey, /^products\//);
    assert.equal(restoredBody.image.sortOrder, 1);
    assert.equal(restoredBody.image.isPrimary, false);
    assert.equal(await prisma.productImageTrash.count({ where: { productId: product.id } }), 0);
    assert.equal(await prisma.productImage.count({ where: { productId: product.id } }), 2);

    const [restoredExists] = await bucket.file(restoredBody.image.storageKey).exists();
    assert.equal(restoredExists, true);
    const [trashAfterRestore] = await bucket.getFiles({ prefix: "trash/product-images/" });
    assert.equal(trashAfterRestore.filter((file) => file.name.endsWith(archiveSuffix)).length, 0);

    console.log("product image delete integration flow: ok");
  } finally {
    if (productId) {
      const imageKeys = await prisma.productImage.findMany({ where: { productId }, select: { storageKey: true } });
      await Promise.all(imageKeys.map((image) => deleteProductImage(image.storageKey).catch(() => undefined)));
      await prisma.productImageTrash.deleteMany({ where: { productId } });
      await prisma.productImage.deleteMany({ where: { productId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }
    await Promise.all([
      deleteProductImage(primaryKey).catch(() => undefined),
      deleteProductImage(secondaryKey).catch(() => undefined),
    ]);
    const [trashFiles] = await bucket.getFiles({ prefix: "trash/product-images/" });
    await Promise.all(
      trashFiles
        .filter((file) => file.name.endsWith(archiveSuffix))
        .map((file) => file.delete({ ignoreNotFound: true }).then(() => undefined))
    );
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
