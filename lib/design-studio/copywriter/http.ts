import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

export type CopywriterAdminIdentity = { id: string; role: string };

export function copywriterJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function canUseCopywriter(admin: CopywriterAdminIdentity) {
  return admin.role === "OWNER" || admin.role === "ADMIN";
}

export async function copywriterAdminSession(request: NextRequest): Promise<CopywriterAdminIdentity | null> {
  return (await import("@/lib/admin-api-auth")).getAdminSession(request);
}

export function mapCopywriterError(error: unknown) {
  if (error instanceof z.ZodError) {
    return copywriterJson({ error: "INVALID_INPUT", message: error.issues[0]?.message ?? "Controleer de invoer." }, 422);
  }
  if (error instanceof Error && "code" in error && "status" in error
    && typeof error.code === "string" && typeof error.status === "number") {
    return copywriterJson({ error: error.code, message: error.message }, error.status);
  }
  return copywriterJson({ error: "INTERNAL_ERROR", message: "De CopyWriter-aanvraag is niet gelukt." }, 500);
}
