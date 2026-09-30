import { Module } from "@nestjs/common"
import { WorkflowModule } from "../workflow/workflow.module"
import { OutboxService } from "./outbox.service"

@Module({
  imports: [WorkflowModule],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {}
