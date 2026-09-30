import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { Prisma, type OutboxJob } from "@prisma/client"
import { PrismaService } from "../prisma/prisma.service"
import { WorkflowStarter } from "../workflow/workflow-starter.service"

export interface EnqueueInput {
  type: string
  payload: Prisma.InputJsonValue
  idempotencyKey?: string
}

@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxService.name)
  private readonly maxAttempts = 5
  private timer?: NodeJS.Timeout
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly starter: WorkflowStarter,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick()
    }, 1500)
    this.timer.unref()
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer)
    }
  }

  enqueue(client: Prisma.TransactionClient, input: EnqueueInput): Promise<OutboxJob> {
    return client.outboxJob.create({
      data: {
        type: input.type,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    })
  }

  async drainById(id: string): Promise<void> {
    const job = await this.prisma.outboxJob.findUnique({ where: { id } })
    if (job && job.status === "PENDING") {
      await this.process(job)
    }
  }

  private async tick(): Promise<void> {
    if (this.running) {
      return
    }
    this.running = true
    try {
      await this.processPending()
    } catch (error) {
      this.logger.error("Outbox tick failed", error as Error)
    } finally {
      this.running = false
    }
  }

  private async processPending(limit = 10): Promise<void> {
    const jobs = await this.prisma.outboxJob.findMany({
      where: { status: "PENDING", availableAt: { lte: new Date() } },
      orderBy: { createdAt: "asc" },
      take: limit,
    })
    for (const job of jobs) {
      await this.process(job)
    }
  }

  private async process(job: OutboxJob): Promise<void> {
    const claimed = await this.prisma.outboxJob.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "PROCESSING" },
    })
    if (claimed.count === 0) {
      return
    }

    try {
      await this.dispatch(job)
      await this.prisma.outboxJob.update({
        where: { id: job.id },
        data: { status: "DONE", processedAt: new Date(), lastError: null },
      })
    } catch (error) {
      const attempts = job.attempts + 1
      const failed = attempts >= this.maxAttempts
      await this.prisma.outboxJob.update({
        where: { id: job.id },
        data: {
          status: failed ? "FAILED" : "PENDING",
          attempts,
          lastError: (error as Error).message.slice(0, 1000),
          availableAt: new Date(Date.now() + attempts * 2000),
        },
      })
      this.logger.error(`Outbox job ${job.id} (${job.type}) attempt ${attempts} failed`, error as Error)
    }
  }

  private async dispatch(job: OutboxJob): Promise<void> {
    switch (job.type) {
      case "workflow.startProcess": {
        const payload = job.payload as unknown as { requestId: string }
        await this.starter.start(payload.requestId)
        return
      }
      default:
        throw new Error(`Unknown outbox job type: ${job.type}`)
    }
  }
}
