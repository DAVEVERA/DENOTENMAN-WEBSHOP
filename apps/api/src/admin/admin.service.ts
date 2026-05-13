import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface AdminStats {
  totalOrders: number;
  pendingOrders: number;
  paidOrders: number;
  fulfilledOrders: number;
  revenueThisMonth: number;
  totalProducts: number;
  activeProducts: number;
  totalCategories: number;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<AdminStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalOrders,
      pendingOrders,
      paidOrders,
      fulfilledOrders,
      revenueResult,
      totalProducts,
      activeProducts,
      totalCategories,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: "pending" } }),
      this.prisma.order.count({ where: { status: "paid" } }),
      this.prisma.order.count({ where: { status: "fulfilled" } }),
      this.prisma.order.aggregate({
        _sum: { totalCents: true },
        where: {
          status: { in: ["paid", "fulfilled"] },
          createdAt: { gte: startOfMonth },
        },
      }),
      this.prisma.product.count({ where: { deletedAt: null } }),
      this.prisma.product.count({ where: { deletedAt: null, status: "active" } }),
      this.prisma.category.count({ where: { deletedAt: null } }),
    ]);

    return {
      totalOrders,
      pendingOrders,
      paidOrders,
      fulfilledOrders,
      revenueThisMonth: revenueResult._sum.totalCents ?? 0,
      totalProducts,
      activeProducts,
      totalCategories,
    };
  }
}
