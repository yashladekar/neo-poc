import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import type {
  AuditEvent as AuditEventDto,
  CreateTravelRequestInput,
  ProcessHistoryEntry,
  SessionUser,
  TravelRequest as TravelRequestDto,
} from "@workspace/contracts"
import { AuditService } from "../audit/audit.service"
import { OutboxService } from "../outbox/outbox.service"
import { PrismaService } from "../prisma/prisma.service"
import { WorkflowClient } from "../workflow/workflow.client"
import { requestInclude, toTravelRequestDto } from "./requests.mapper"

const READ_ALL_PERMISSION = "request:read:all"

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly workflow: WorkflowClient,
  ) {}

  async submit(user: SessionUser, input: CreateTravelRequestInput): Promise<TravelRequestDto> {
    const totalAmount = input.items.reduce((sum, item) => sum + item.amount, 0)
    const { requestId, jobId } = await this.createRequestWithOutbox(user, input, totalAmount)

    await this.audit.record({
      entityType: "TravelRequest",
      entityId: requestId,
      requestId,
      actorId: user.id,
      action: "SUBMITTED",
      data: { totalAmount, currency: input.currency, hasReceipts: input.hasReceipts },
    })

    // Attempt the process start immediately so submit-and-start is synchronous for
    // the user; the polling worker retries from the outbox if this throws.
    await this.outbox.drainById(jobId)

    return this.get(user, requestId)
  }

  async list(user: SessionUser): Promise<TravelRequestDto[]> {
    const where: Prisma.TravelRequestWhereInput = this.canReadAll(user) ? {} : { submittedById: user.id }
    const requests = await this.prisma.travelRequest.findMany({
      where,
      include: requestInclude,
      orderBy: { createdAt: "desc" },
    })
    return requests.map(toTravelRequestDto)
  }

  async get(user: SessionUser, id: string): Promise<TravelRequestDto> {
    const request = await this.prisma.travelRequest.findUnique({ where: { id }, include: requestInclude })
    if (!request) {
      throw new NotFoundException("Travel request not found")
    }
    if (!this.canReadAll(user) && request.submittedById !== user.id) {
      throw new ForbiddenException("You cannot view this request")
    }
    return toTravelRequestDto(request)
  }

  async listAudit(user: SessionUser, id: string): Promise<AuditEventDto[]> {
    await this.get(user, id)
    const events = await this.prisma.auditEvent.findMany({
      where: { requestId: id },
      orderBy: { createdAt: "asc" },
    })
    return events.map((event) => ({
      id: event.id,
      action: event.action,
      actorId: event.actorId,
      data: event.data ?? null,
      createdAt: event.createdAt.toISOString(),
    }))
  }

  /** The engine's own activity history for the request's process instance. */
  async listHistory(user: SessionUser, id: string): Promise<ProcessHistoryEntry[]> {
    const request = await this.prisma.travelRequest.findUnique({
      where: { id },
      select: { submittedById: true, workflowInstanceId: true },
    })
    if (!request) {
      throw new NotFoundException("Travel request not found")
    }
    if (!this.canReadAll(user) && request.submittedById !== user.id) {
      throw new ForbiddenException("You cannot view this request")
    }
    if (!request.workflowInstanceId) {
      return []
    }
    const history = await this.workflow.getHistory(request.workflowInstanceId)
    return history.map((entry) => ({
      activityId: entry.activityId,
      activityName: entry.activityName,
      activityType: entry.activityType,
      startTime: entry.startTime,
      endTime: entry.endTime,
    }))
  }

  private canReadAll(user: SessionUser): boolean {
    return user.permissions.includes(READ_ALL_PERMISSION)
  }

  private async createRequestWithOutbox(
    user: SessionUser,
    input: CreateTravelRequestInput,
    totalAmount: number,
  ): Promise<{ requestId: string; jobId: string }> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const reference = await this.nextReference(tx)
          const request = await tx.travelRequest.create({
            data: {
              reference,
              title: input.title,
              purpose: input.purpose ?? null,
              destination: input.destination,
              startDate: new Date(input.startDate),
              endDate: new Date(input.endDate),
              totalAmount,
              currency: input.currency,
              hasReceipts: input.hasReceipts,
              status: "SUBMITTED",
              submittedById: user.id,
              items: {
                create: input.items.map((item) => ({
                  category: item.category,
                  description: item.description,
                  amount: item.amount,
                  incurredOn: item.incurredOn ? new Date(item.incurredOn) : null,
                  receiptRequired: item.receiptRequired,
                })),
              },
            },
            select: { id: true },
          })
          const job = await this.outbox.enqueue(tx, {
            type: "workflow.startProcess",
            payload: { requestId: request.id },
            idempotencyKey: `workflow.startProcess:${request.id}`,
          })
          return { requestId: request.id, jobId: job.id }
        })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4) {
          continue
        }
        throw error
      }
    }
    throw new Error("Could not allocate a unique travel request reference")
  }

  private async nextReference(client: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getFullYear()
    const prefix = `TR-${year}-`
    const count = await client.travelRequest.count({ where: { reference: { startsWith: prefix } } })
    return `${prefix}${String(count + 1).padStart(4, "0")}`
  }
}
