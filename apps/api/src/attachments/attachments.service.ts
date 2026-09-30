import { Inject, Injectable, NotFoundException } from "@nestjs/common"
import { randomUUID } from "node:crypto"
import { mkdir, stat, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import type { Attachment as AttachmentDto, SessionUser } from "@workspace/contracts"
import { ENV } from "../config/config.module"
import type { Env } from "../config/env"
import { PrismaService } from "../prisma/prisma.service"

export interface StoredFile {
  attachment: AttachmentDto
  absolutePath: string
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async save(requestId: string, user: SessionUser, file: Express.Multer.File): Promise<AttachmentDto> {
    const safeName = basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_")
    const storageKey = `${requestId}/${randomUUID()}-${safeName}`
    const absolutePath = join(this.env.STORAGE_DIR, storageKey)

    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, file.buffer)

    const attachment = await this.prisma.attachment.create({
      data: {
        requestId,
        name: file.originalname,
        contentType: file.mimetype || "application/octet-stream",
        size: file.size,
        storageKey,
        uploadedById: user.id,
      },
      include: { uploadedBy: { select: { name: true } } },
    })

    return {
      id: attachment.id,
      name: attachment.name,
      contentType: attachment.contentType,
      size: attachment.size,
      uploadedByName: attachment.uploadedBy.name,
      createdAt: attachment.createdAt.toISOString(),
    }
  }

  async listForRequest(requestId: string): Promise<AttachmentDto[]> {
    const attachments = await this.prisma.attachment.findMany({
      where: { requestId },
      orderBy: { createdAt: "asc" },
      include: { uploadedBy: { select: { name: true } } },
    })
    return attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      contentType: attachment.contentType,
      size: attachment.size,
      uploadedByName: attachment.uploadedBy.name,
      createdAt: attachment.createdAt.toISOString(),
    }))
  }

  /** Returns the attachment plus the request it belongs to, for authorization. */
  async open(id: string): Promise<StoredFile & { requestId: string | null }> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: { uploadedBy: { select: { name: true } } },
    })
    if (!attachment) {
      throw new NotFoundException("Attachment not found")
    }
    const absolutePath = join(this.env.STORAGE_DIR, attachment.storageKey)
    await stat(absolutePath).catch(() => {
      throw new NotFoundException("Attachment payload is missing from storage")
    })
    return {
      attachment: {
        id: attachment.id,
        name: attachment.name,
        contentType: attachment.contentType,
        size: attachment.size,
        uploadedByName: attachment.uploadedBy.name,
        createdAt: attachment.createdAt.toISOString(),
      },
      absolutePath,
      requestId: attachment.requestId,
    }
  }
}
