import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { AuditService } from "../audit/audit.service"
import { ENV } from "../config/config.module"
import type { Env } from "../config/env"
import { PrismaService } from "../prisma/prisma.service"
import { WorkflowClient } from "../workflow/workflow.client"
import { deriveStatus } from "../workflow/workflow-status"

export interface ReconciliationResult {
  checked: number
  corrected: number
}

/**
 * Repairs drift between the workflow engine and the application projection.
 *
 * Service-task side effects commit in the application layer, so if the engine
 * transaction later rolls back (or a delegate dies mid-flight), a request row can
 * disagree with the engine. The engine is the source of truth for process state,
 * so this job re-derives `status` / `workflowStatus` / `currentTaskKey` from it.
 */
@Injectable()
export class ReconciliationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationService.name)
  private timer?: NodeJS.Timeout
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: WorkflowClient,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    const seconds = this.env.RECONCILIATION_INTERVAL_SECONDS
    if (seconds <= 0) {
      this.logger.log("Projection reconciliation is disabled")
      return
    }
    this.timer = setInterval(() => {
      void this.reconcileOnce()
    }, seconds * 1000)
    this.timer.unref()
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer)
    }
  }

  async reconcileOnce(): Promise<ReconciliationResult> {
    if (this.running) {
      return { checked: 0, corrected: 0 }
    }
    this.running = true
    try {
      return await this.reconcile()
    } finally {
      this.running = false
    }
  }

  private async reconcile(): Promise<ReconciliationResult> {
    const requests = await this.prisma.travelRequest.findMany({
      // Deliberately NOT filtered on the app's workflowStatus: a failed read-back
      // can leave a row marked ENDED while the engine is still running, so the
      // app's own value must never decide what gets checked.
      where: { workflowInstanceId: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        reference: true,
        status: true,
        workflowStatus: true,
        currentTaskKey: true,
        workflowInstanceId: true,
      },
      take: 100,
    })

    let corrected = 0
    for (const request of requests) {
      try {
        const instance = await this.workflow.getProcessInstance(request.workflowInstanceId as string)
        const status = deriveStatus(instance)
        const workflowStatus = instance.ended ? "ENDED" : "RUNNING"
        const currentTaskKey = instance.activeTaskKeys[0] ?? null

        const inSync =
          status === request.status &&
          workflowStatus === request.workflowStatus &&
          currentTaskKey === request.currentTaskKey
        if (inSync) {
          continue
        }

        await this.prisma.travelRequest.update({
          where: { id: request.id },
          data: { status, workflowStatus, currentTaskKey },
        })
        await this.audit.record({
          entityType: "TravelRequest",
          entityId: request.id,
          requestId: request.id,
          action: "RECONCILED",
          data: {
            from: {
              status: request.status,
              workflowStatus: request.workflowStatus,
              currentTaskKey: request.currentTaskKey,
            },
            to: { status, workflowStatus, currentTaskKey },
          } as Prisma.InputJsonValue,
        })
        corrected += 1
      } catch (error) {
        this.logger.warn(`Reconciliation failed for ${request.reference}: ${(error as Error).message}`)
      }
    }

    if (corrected > 0) {
      this.logger.warn(`Reconciled ${corrected} of ${requests.length} request projection(s)`)
    }
    return { checked: requests.length, corrected }
  }
}
