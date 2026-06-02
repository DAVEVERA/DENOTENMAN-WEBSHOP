import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AdminService } from "./admin.service";
import { Roles } from "../auth/decorators/roles.decorator";
import type { AdminStats } from "./admin.service";

@Roles("owner", "admin", "staff")
@ApiTags("admin")
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("stats")
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Dashboard statistieken (admin)" })
  @ApiResponse({ status: 200, description: "Statistieken overzicht" })
  stats(): Promise<AdminStats> {
    return this.adminService.getStats();
  }
}
