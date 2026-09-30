import { Module } from "@nestjs/common"
import { WorkflowModule } from "../workflow/workflow.module"
import { ReconciliationController } from "./reconciliation.controller"
import { ReconciliationService } from "./reconciliation.service"

@Module({
  imports: [WorkflowModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
