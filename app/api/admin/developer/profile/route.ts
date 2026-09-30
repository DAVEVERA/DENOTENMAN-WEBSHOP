import type { NextRequest } from "next/server";

import { developerErrorResponse, developerJson, readJson, requireDeveloper } from "@/lib/developer-portal/http";
import { developerProfileDto, getDeveloperProfile, updateDeveloperProfile } from "@/lib/developer-portal/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = await requireDeveloper(request);
  if (guard.response) return guard.response;
  return developerJson({ profile: developerProfileDto(await getDeveloperProfile()) });
}

export async function PUT(request: NextRequest) {
  const guard = await requireDeveloper(request, { write: true });
  if (guard.response) return guard.response;
  try {
    return developerJson({ profile: await updateDeveloperProfile(await readJson(request)) });
  } catch (error) {
    return developerErrorResponse(error);
  }
}
