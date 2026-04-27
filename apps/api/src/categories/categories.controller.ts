import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { CategoriesService } from "./categories.service";

@ApiTags("categories")
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: "Categorie-boom met producttelling" })
  tree() {
    return this.categories.tree();
  }

  @Get(":slug")
  @ApiOperation({ summary: "Categorie detail op slug" })
  findBySlug(@Param("slug") slug: string) {
    return this.categories.findBySlug(slug);
  }
}
