import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { Paginated } from "@denotenman/schemas";

interface ListProductsOptions {
  page: number;
  pageSize: number;
  categorySlug?: string;
  search?: string;
  status?: string;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(options: ListProductsOptions): Promise<Paginated<unknown>> {
    const { page, pageSize, categorySlug, search, status } = options;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {
      deletedAt: null,
      status: status ?? "active",
    };

    if (categorySlug) {
      where.category = { slug: categorySlug, deletedAt: null };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          variants: {
            where: { deletedAt: null },
            orderBy: { position: "asc" },
          },
          images: { orderBy: { position: "asc" } },
          category: { select: { id: true, slug: true, name: true } },
          tags: { include: { tag: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const mapped = items.map((p) => ({
      ...p,
      tags: p.tags.map((pt) => pt.tag),
    }));

    return { items: mapped, page, pageSize, total };
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null, status: "active" },
      include: {
        variants: {
          where: { deletedAt: null },
          orderBy: { position: "asc" },
        },
        images: { orderBy: { position: "asc" } },
        category: {
          include: {
            parent: { select: { id: true, slug: true, name: true } },
          },
        },
        tags: { include: { tag: true } },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product niet gevonden: ${slug}`);
    }

    return {
      ...product,
      tags: product.tags.map((pt) => pt.tag),
    };
  }
}
