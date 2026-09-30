import { Module } from "@nestjs/common"
import { WorkflowClient } from "./workflow.client"
import { WorkflowStarter } from "./workflow-starter.service"

@Module({
  providers: [WorkflowClient, WorkflowStarter],
  exports: [WorkflowClient, WorkflowStarter],
})
export class WorkflowModule {}
