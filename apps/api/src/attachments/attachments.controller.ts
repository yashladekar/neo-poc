import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import type { SessionUser } from "@workspace/contracts"
import { createReadStream } from "node:fs"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PermissionsGuard } from "../auth/permissions.guard"
import { CurrentUser } from "../common/current-user.decorator"
import { RequestsService } from "../requests/requests.service"
import { AttachmentsService } from "./attachments.service"

const MAX_BYTES = 5 * 1024 * 1024

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttachmentsController {
  constructor(
    private readonly attachments: AttachmentsService,
    private readonly requests: RequestsService,
  ) {}

  @Post("requests/:id/attachments")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_BYTES } }))
  async upload(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("A file is required")
    }
    // Reuses request-level authorization before accepting the upload.
    await this.requests.get(user, id)
    return this.attachments.save(id, user, file)
  }

  @Get("requests/:id/attachments")
  async list(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    await this.requests.get(user, id)
    return this.attachments.listForRequest(id)
  }

  @Get("attachments/:attachmentId/download")
  async download(
    @CurrentUser() user: SessionUser,
    @Param("attachmentId") attachmentId: string,
  ): Promise<StreamableFile> {
    const { attachment, absolutePath, requestId } = await this.attachments.open(attachmentId)
    if (requestId) {
      await this.requests.get(user, requestId)
    }
    return new StreamableFile(createReadStream(absolutePath), {
      type: attachment.contentType,
      disposition: `attachment; filename="${attachment.name.replace(/"/g, "")}"`,
    })
  }
}
