import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common"
import type { CreateTravelRequestInput, SessionUser } from "@workspace/contracts"
import { createTravelRequestSchema } from "@workspace/contracts"
import { CurrentUser } from "../common/current-user.decorator"
import { ZodValidationPipe } from "../common/zod-validation.pipe"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { RequirePermissions } from "../auth/permissions.decorator"
import { PermissionsGuard } from "../auth/permissions.guard"
import { RequestsService } from "./requests.service"

@Controller("requests")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Post()
  @RequirePermissions("request:create")
  submit(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(createTravelRequestSchema)) body: CreateTravelRequestInput,
  ) {
    return this.requests.submit(user, body)
  }

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.requests.list(user)
  }

  @Get(":id")
  get(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.requests.get(user, id)
  }

  @Get(":id/audit")
  audit(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.requests.listAudit(user, id)
  }

  @Get(":id/history")
  history(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.requests.listHistory(user, id)
  }
}
