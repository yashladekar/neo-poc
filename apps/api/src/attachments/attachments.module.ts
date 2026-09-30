import { Module } from "@nestjs/common"
import { RequestsModule } from "../requests/requests.module"
import { AttachmentsController } from "./attachments.controller"
import { AttachmentsService } from "./attachments.service"

@Module({
  imports: [RequestsModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
