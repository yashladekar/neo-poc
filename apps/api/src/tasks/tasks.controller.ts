import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common"
import type { DecisionInput, SessionUser } from "@workspace/contracts"
import { decisionInputSchema } from "@workspace/contracts"
import { CurrentUser } from "../common/current-user.decorator"
import { ZodValidationPipe } from "../common/zod-validation.pipe"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PermissionsGuard } from "../auth/permissions.guard"
import { TasksService } from "./tasks.service"

@Controller("tasks")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.tasks.listForUser(user)
  }

  @Get(":taskId")
  get(@CurrentUser() user: SessionUser, @Param("taskId") taskId: string) {
    return this.tasks.getForUser(user, taskId)
  }

  @Post(":taskId/complete")
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentUser() user: SessionUser,
    @Param("taskId") taskId: string,
    @Body(new ZodValidationPipe(decisionInputSchema)) body: DecisionInput,
  ) {
    return this.tasks.complete(user, taskId, body)
  }
}
