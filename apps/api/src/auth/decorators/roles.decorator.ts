import { SetMetadata } from "@nestjs/common";
import { ROLES_KEY } from "../auth.constants";
import type { UserRole } from "@denotenman/schemas";

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
