import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { Paginated } from "@denotenman/schemas";
import { CreateProductDtoSchema } from "./dto/create-product.dto";
import { UpdateProductDtoSchema } from "./dto/update-product.dto";
import { CreateVariantDtoSchema } from "./dto/create-variant.dto";
import { UpdateVariantDtoSchema } from "./dto/update-variant.dto";
import type { CreateProductDto } from "./dto/create-product.dto";
import type { UpdateProductDto } from "./dto/update-product.dto";
import type { CreateVariantDto } from "./dto/create-variant.dto";
import type { UpdateVariantDto } from "./dto/update-variant.dto";

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

  async create(raw: CreateProductDto): Promise<unknown> {
    const parsed = CreateProductDtoSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Ongeldige productgegevens",
          details: parsed.error.flatten(),
        },
      });
    }

    const dto = parsed.data;

    try {
      return await this.prisma.product.create({
        data: {
          sku: dto.sku,
          slug: dto.slug,
          name: dto.name,
          description: dto.description,
          categoryId: dto.categoryId,
          status: dto.status,
          origin: dto.origin,
          harvestYear: dto.harvestYear,
          roasted: dto.roasted,
          organic: dto.organic,
          allergens: dto.allergens,
          ingredients: dto.ingredients,
          storageInfo: dto.storageInfo,
          tasteNotes: dto.tasteNotes,
          usageTip: dto.usageTip,
        },
        include: {
          variants: { where: { deletedAt: null }, orderBy: { position: "asc" } },
          images: { orderBy: { position: "asc" } },
          category: { select: { id: true, slug: true, name: true } },
          tags: { include: { tag: true } },
        },
      });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === "P2002") {
        throw new ConflictException({
          error: { code: "PRODUCT_CONFLICT", message: "SKU of slug is al in gebruik" },
        });
      }
      throw err;
    }
  }

  async update(id: string, raw: UpdateProductDto): Promise<unknown> {
    const parsed = UpdateProductDtoSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Ongeldige productgegevens",
          details: parsed.error.flatten(),
        },
      });
    }

    const dto = parsed.data;

    try {
      return await this.prisma.product.update({
        where: { id },
        data: dto,
        include: {
          variants: { where: { deletedAt: null }, orderBy: { position: "asc" } },
          images: { orderBy: { position: "asc" } },
          category: { select: { id: true, slug: true, name: true } },
          tags: { include: { tag: true } },
        },
      });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === "P2025") {
        throw new NotFoundException({
          error: { code: "PRODUCT_NOT_FOUND", message: `Product niet gevonden: ${id}` },
        });
      }
      if (e.code === "P2002") {
        throw new ConflictException({
          error: { code: "PRODUCT_CONFLICT", message: "SKU of slug is al in gebruik" },
        });
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.product.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === "P2025") {
        throw new NotFoundException({
          error: { code: "PRODUCT_NOT_FOUND", message: `Product niet gevonden: ${id}` },
        });
      }
      throw err;
    }
  }

  async addVariant(productId: string, raw: CreateVariantDto): Promise<unknown> {
    const parsed = CreateVariantDtoSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Ongeldige variantgegevens",
          details: parsed.error.flatten(),
        },
      });
    }

    const dto = parsed.data;

    return this.prisma.productVariant.create({
      data: {
        productId,
        sku: dto.sku,
        name: dto.name,
        weightGrams: dto.weightGrams,
        priceCents: dto.priceCents,
        currency: dto.currency,
        stockQuantity: dto.stockQuantity,
        lowStockAt: dto.lowStockAt,
        position: dto.position,
      },
    });
  }

  async updateVariant(
    productId: string,
    variantId: string,
    raw: UpdateVariantDto,
  ): Promise<unknown> {
    const parsed = UpdateVariantDtoSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Ongeldige variantgegevens",
          details: parsed.error.flatten(),
        },
      });
    }

    const dto = parsed.data;

    try {
      return await this.prisma.productVariant.update({
        where: { id: variantId, productId },
        data: dto,
      });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === "P2025") {
        throw new NotFoundException({
          error: { code: "VARIANT_NOT_FOUND", message: `Variant niet gevonden: ${variantId}` },
        });
      }
      throw err;
    }
  }

  async removeVariant(productId: string, variantId: string): Promise<void> {
    try {
      await this.prisma.productVariant.update({
        where: { id: variantId, productId },
        data: { deletedAt: new Date() },
      });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === "P2025") {
        throw new NotFoundException({
          error: { code: "VARIANT_NOT_FOUND", message: `Variant niet gevonden: ${variantId}` },
        });
      }
      throw err;
    }
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
