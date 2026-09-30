import { Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common"
import { InternalTokenGuard } from "../internal/internal-token.guard"
import { ReconciliationService } from "./reconciliation.service"

/** Operator hook to force a reconciliation pass (also used by tests). */
@Controller("internal/reconciliation")
@UseGuards(InternalTokenGuard)
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}

  @Post("run")
  @HttpCode(HttpStatus.OK)
  run() {
    return this.reconciliation.reconcileOnce()
  }
}
