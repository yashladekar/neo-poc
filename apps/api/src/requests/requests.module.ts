import { Module } from "@nestjs/common"
import { OutboxModule } from "../outbox/outbox.module"
import { WorkflowModule } from "../workflow/workflow.module"
import { RequestsController } from "./requests.controller"
import { RequestsService } from "./requests.service"

@Module({
  imports: [OutboxModule, WorkflowModule],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
