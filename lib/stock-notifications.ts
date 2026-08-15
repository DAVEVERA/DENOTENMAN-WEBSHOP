import { prisma } from "@/lib/prisma";
import { BASE_URL, product as productPath } from "@/lib/routes";
import { sendBackInStockEmail } from "@/lib/mail";

export async function notifyPendingStockSubscribers(productId: string): Promise<number> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      translations: true,
      stockNotifications: { where: { status: "PENDING" }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!product?.isActive || product.stockNotifications.length === 0) return 0;

  let sentCount = 0;
  for (const notification of product.stockNotifications) {
    const translation =
      product.translations.find((item) => item.locale === notification.locale) ??
      product.translations.find((item) => item.locale === "nl");
    if (!translation) continue;

    const sent = await sendBackInStockEmail({
      notificationId: notification.id,
      email: notification.email,
      locale: notification.locale,
      productName: translation.name,
      productUrl: `${BASE_URL}${productPath(notification.locale, translation.slug)}`,
    });
    if (!sent) continue;

    const updated = await prisma.stockNotification.updateMany({
      where: { id: notification.id, status: "PENDING" },
      data: { status: "SENT", notifiedAt: new Date(), activeKey: null },
    });
    sentCount += updated.count;
  }

  return sentCount;
}
