import { revalidatePath } from "next/cache";

export function revalidateProductFaq(productId: string): boolean {
  try {
    revalidatePath("/", "layout");
    return true;
  } catch (error) {
    console.error("Failed to revalidate product FAQ", { productId, error });
    return false;
  }
}
