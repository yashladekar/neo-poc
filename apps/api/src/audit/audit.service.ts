import { Injectable } from "@nestjs/common"
import { Prisma, type AuditEvent } from "@prisma/client"
import { PrismaService } from "../prisma/prisma.service"

export interface AuditRecordInput {
  entityType: string
  entityId: string
  action: string
  actorId?: string | null
  requestId?: string | null
  data?: Prisma.InputJsonValue
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: AuditRecordInput): Promise<AuditEvent> {
    return this.prisma.auditEvent.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        actorId: input.actorId ?? null,
        requestId: input.requestId ?? null,
        data: input.data ?? Prisma.JsonNull,
      },
    })
  }

  listForRequest(requestId: string) {
    return this.prisma.auditEvent.findMany({
      where: { requestId },
      orderBy: { createdAt: "asc" },
    })
  }
}
