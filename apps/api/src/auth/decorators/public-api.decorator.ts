import { SetMetadata } from "@nestjs/common";
import { IS_PUBLIC_KEY } from "../auth.constants";

/**
 * Routes decorated with @PublicApi() are exempt from:
 * - JwtAuthGuard (no JWT required)
 * - CsrfGuard (Bearer-only routes have no CSRF surface)
 *
 * Per ADR 0009: the exempt check reads this metadata, not URL strings.
 */
export const PublicApi = () => SetMetadata(IS_PUBLIC_KEY, true);
