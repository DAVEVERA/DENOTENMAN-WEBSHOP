import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCategoryDtoSchema } from "./dto/create-category.dto";
import { UpdateCategoryDtoSchema } from "./dto/update-category.dto";
import type { CreateCategoryDto } from "./dto/create-category.dto";
import type { UpdateCategoryDto } from "./dto/update-category.dto";

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

  async create(raw: CreateCategoryDto): Promise<unknown> {
    const parsed = CreateCategoryDtoSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Ongeldige categoriegegevens",
          details: parsed.error.flatten(),
        },
      });
    }

    const dto = parsed.data;

    try {
      return await this.prisma.category.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description ?? null,
          parentId: dto.parentId ?? null,
          sortOrder: dto.sortOrder,
        },
      });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === "P2002") {
        throw new ConflictException({
          error: { code: "CATEGORY_CONFLICT", message: "Slug is al in gebruik" },
        });
      }
      throw err;
    }
  }

  async update(id: string, raw: UpdateCategoryDto): Promise<unknown> {
    const parsed = UpdateCategoryDtoSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Ongeldige categoriegegevens",
          details: parsed.error.flatten(),
        },
      });
    }

    const dto = parsed.data;

    try {
      return await this.prisma.category.update({
        where: { id },
        data: dto,
      });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === "P2025") {
        throw new NotFoundException({
          error: { code: "CATEGORY_NOT_FOUND", message: `Categorie niet gevonden: ${id}` },
        });
      }
      if (e.code === "P2002") {
        throw new ConflictException({
          error: { code: "CATEGORY_CONFLICT", message: "Slug is al in gebruik" },
        });
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.category.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === "P2025") {
        throw new NotFoundException({
          error: { code: "CATEGORY_NOT_FOUND", message: `Categorie niet gevonden: ${id}` },
        });
      }
      throw err;
    }
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
