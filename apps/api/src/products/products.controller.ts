import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ProductsService } from "./products.service";
import { PublicApi } from "../auth/decorators/public-api.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { CreateProductDto } from "./dto/create-product.dto";
import type { UpdateProductDto } from "./dto/update-product.dto";
import type { CreateVariantDto } from "./dto/create-variant.dto";
import type { UpdateVariantDto } from "./dto/update-variant.dto";

@ApiTags("products")
@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @PublicApi()
  @Get()
  @Throttle({ public: { limit: 100, ttl: 60_000 } })
  @ApiOperation({ summary: "Lijst producten (gepagineerd)" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "category", required: false, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  list(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("category") category?: string,
    @Query("search") search?: string,
  ) {
    return this.products.list({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? Math.min(parseInt(pageSize, 10), 100) : 20,
      categorySlug: category,
      search,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles("owner", "admin", "staff")
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Product aanmaken (admin)" })
  create(@Body() dto: CreateProductDto): Promise<unknown> {
    return this.products.create(dto);
  }

  @PublicApi()
  @Get(":slug")
  @Throttle({ public: { limit: 100, ttl: 60_000 } })
  @ApiOperation({ summary: "Product detail op slug" })
  @ApiParam({ name: "slug", type: "string" })
  findBySlug(@Param("slug") slug: string) {
    return this.products.findBySlug(slug);
  }

  @Patch(":id")
  @Roles("owner", "admin", "staff")
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Product bijwerken (admin)" })
  @ApiParam({ name: "id", type: "string", format: "uuid" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto): Promise<unknown> {
    return this.products.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("owner", "admin", "staff")
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Product soft-deleten (admin)" })
  @ApiParam({ name: "id", type: "string", format: "uuid" })
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.products.remove(id);
  }

  @Post(":id/variants")
  @HttpCode(HttpStatus.CREATED)
  @Roles("owner", "admin", "staff")
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Variant toevoegen aan product (admin)" })
  @ApiParam({ name: "id", type: "string", format: "uuid" })
  addVariant(
    @Param("id", ParseUUIDPipe) productId: string,
    @Body() dto: CreateVariantDto,
  ): Promise<unknown> {
    return this.products.addVariant(productId, dto);
  }

  @Patch(":id/variants/:variantId")
  @Roles("owner", "admin", "staff")
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Variant bijwerken (admin)" })
  @ApiParam({ name: "id", type: "string", format: "uuid" })
  @ApiParam({ name: "variantId", type: "string", format: "uuid" })
  updateVariant(
    @Param("id", ParseUUIDPipe) productId: string,
    @Param("variantId", ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateVariantDto,
  ): Promise<unknown> {
    return this.products.updateVariant(productId, variantId, dto);
  }

  @Delete(":id/variants/:variantId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("owner", "admin", "staff")
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Variant soft-deleten (admin)" })
  @ApiParam({ name: "id", type: "string", format: "uuid" })
  @ApiParam({ name: "variantId", type: "string", format: "uuid" })
  removeVariant(
    @Param("id", ParseUUIDPipe) productId: string,
    @Param("variantId", ParseUUIDPipe) variantId: string,
  ): Promise<void> {
    return this.products.removeVariant(productId, variantId);
  }
}
