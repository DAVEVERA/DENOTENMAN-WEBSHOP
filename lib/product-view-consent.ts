export const PRODUCT_VIEW_SESSION_KEY_PREFIX = "denotenman-product-view-v1:";

export function clearProductViewSessionStorage(storage: Storage): void {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key?.startsWith(PRODUCT_VIEW_SESSION_KEY_PREFIX)) storage.removeItem(key);
  }
}
