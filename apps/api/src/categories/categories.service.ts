import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async tree() {
    const all = await this.prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { products: { where: { deletedAt: null, status: "active" } } } },
      },
    });

    const topLevel = all.filter((c) => c.parentId === null);

    return topLevel.map((parent) => ({
      ...parent,
      productCount: parent._count.products,
      children: all
        .filter((c) => c.parentId === parent.id)
        .map((child) => ({
          ...child,
          productCount: child._count.products,
        })),
    }));
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findFirst({
      where: { slug, deletedAt: null },
      include: {
        parent: { select: { id: true, slug: true, name: true } },
        children: {
          where: { deletedAt: null },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Categorie niet gevonden: ${slug}`);
    }

    return category;
  }
}
