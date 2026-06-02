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
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CategoriesService } from "./categories.service";
import { PublicApi } from "../auth/decorators/public-api.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { CreateCategoryDto } from "./dto/create-category.dto";
import type { UpdateCategoryDto } from "./dto/update-category.dto";

@ApiTags("categories")
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @PublicApi()
  @Get()
  @Throttle({ public: { limit: 100, ttl: 60_000 } })
  @ApiOperation({ summary: "Categorie-boom met producttelling" })
  tree() {
    return this.categories.tree();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles("owner", "admin")
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Categorie aanmaken (admin)" })
  create(@Body() dto: CreateCategoryDto): Promise<unknown> {
    return this.categories.create(dto);
  }

  @PublicApi()
  @Get(":slug")
  @Throttle({ public: { limit: 100, ttl: 60_000 } })
  @ApiOperation({ summary: "Categorie detail op slug" })
  @ApiParam({ name: "slug", type: "string" })
  findBySlug(@Param("slug") slug: string) {
    return this.categories.findBySlug(slug);
  }

  @Patch(":id")
  @Roles("owner", "admin")
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Categorie bijwerken (admin)" })
  @ApiParam({ name: "id", type: "string", format: "uuid" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto): Promise<unknown> {
    return this.categories.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("owner", "admin")
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Categorie soft-deleten (admin)" })
  @ApiParam({ name: "id", type: "string", format: "uuid" })
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.categories.remove(id);
  }
}
