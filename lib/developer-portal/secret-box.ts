import "server-only";

import { openWithPurpose, sealWithPurpose } from "@/lib/secret-box";

// Encrypts the developer's payment credentials (the Stripe key) before they are stored.
const PURPOSE = "developer-portal-secret-box-v1";

export function sealSecret(plain: string): string {
  return sealWithPurpose(plain, PURPOSE);
}

/** Null when the value cannot be decrypted, for example after the admin secret was rotated. */
export function openSecret(sealed: string | null | undefined): string | null {
  return openWithPurpose(sealed, PURPOSE);
}
