import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { ProductsService } from "./products.service";

@ApiTags("products")
@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
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

  @Get(":slug")
  @ApiOperation({ summary: "Product detail op slug" })
  findBySlug(@Param("slug") slug: string) {
    return this.products.findBySlug(slug);
  }
}
