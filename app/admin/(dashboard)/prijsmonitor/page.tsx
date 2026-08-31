import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PriceMonitorWorkspace } from "@/components/admin-panel/price-monitor/PriceMonitorWorkspace";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { hasProductWritePermission } from "@/lib/admin-request-security";
import { getApexScanSummary } from "@/lib/price-monitor/apex-scan";
import {
  emptyPriceMonitorDashboard,
  getPriceMonitorDashboard,
} from "@/lib/price-monitor/service";

export const metadata = {
  title: "Prijsmonitor | De Notenman Admin",
  description: "Vergelijk concurrentieprijzen en bereid gecontroleerde prijsacties voor.",
};

export default async function PriceMonitorPage() {
  await connection();
  const session = await verifyAdminSessionToken(
    (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  );
  if (!session) redirect("/admin/login");
  const admin = await prisma.adminUser.findUnique({
    where: { id: session.userId },
    select: { active: true, role: true },
  });
  if (!admin?.active) redirect("/admin/login");

  let dashboard;
  try {
    dashboard = await getPriceMonitorDashboard();
  } catch (error) {
    const migrationPending =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022");
    if (!migrationPending) {
      console.error("Initial price monitor load failed", { error });
      throw error;
    }
    dashboard = emptyPriceMonitorDashboard(migrationPending);
  }

  return (
    <PriceMonitorWorkspace
      initialDashboard={dashboard}
      initialApexScan={getApexScanSummary()}
      canWrite={hasProductWritePermission(admin.role)}
    />
  );
}
