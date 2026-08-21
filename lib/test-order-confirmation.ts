import type { Order, OrderItem } from "@prisma/client";
import { sendOrderConfirmationEmail } from "@/lib/mail";

type CompletedTestOrder = Order & { items: OrderItem[] };
type ConfirmationSender = (order: Order, items: OrderItem[]) => Promise<void>;

export async function sendCompletedTestOrderConfirmation(
  order: CompletedTestOrder,
  sendConfirmation: ConfirmationSender = sendOrderConfirmationEmail
): Promise<void> {
  try {
    await sendConfirmation(order, order.items);
  } catch (error) {
    console.error(`Failed to send test order confirmation email for order ${order.id}`, error);
  }
}
