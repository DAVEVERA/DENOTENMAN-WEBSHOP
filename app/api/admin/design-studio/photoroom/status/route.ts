import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { getPhotoRoomAvailability } from "@/lib/design-studio/photoroom-provider";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (admin.role !== "OWNER" && admin.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN", message: "Alleen owners en admins mogen PhotoRoom gebruiken." }, { status: 403 });
  }

  const availability = await getPhotoRoomAvailability();
  return NextResponse.json(availability, { headers: { "Cache-Control": "no-store" } });
}
