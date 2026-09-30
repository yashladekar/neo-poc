import { Controller, Get, Param, UseGuards } from "@nestjs/common"
import type { SessionUser } from "@workspace/contracts"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PermissionsGuard } from "../auth/permissions.guard"
import { CurrentUser } from "../common/current-user.decorator"
import { RequestsService } from "../requests/requests.service"
import { IntegrationsService } from "./integrations.service"

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly requests: RequestsService,
  ) {}

  @Get("requests/:id/integrations")
  async list(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    // Reuses the request-level authorization (owner or request:read:all).
    await this.requests.get(user, id)
    return this.integrations.listForRequest(id)
  }
}
