import { Inject, Injectable, Logger } from "@nestjs/common"
import { AuditService } from "../audit/audit.service"
import { ENV } from "../config/config.module"
import type { Env } from "../config/env"
import { PrismaService } from "../prisma/prisma.service"
import { WorkflowClient } from "./workflow.client"
import { deriveStatus } from "./workflow-status"
import type { WorkflowProcessInstance } from "./workflow.types"

@Injectable()
export class WorkflowStarter {
  private readonly logger = new Logger(WorkflowStarter.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: WorkflowClient,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Starts the configured process for a travel request. Idempotent: if the request
   * already has a workflow instance (e.g. a retried outbox job), it is a no-op.
   */
  async start(requestId: string): Promise<void> {
    const request = await this.prisma.travelRequest.findUnique({ where: { id: requestId } })
    if (!request) {
      this.logger.warn(`Cannot start workflow: request ${requestId} not found`)
      return
    }
    if (request.workflowInstanceId) {
      return
    }

    const instance = await this.workflow.startProcess({
      processDefinitionKey: this.env.WORKFLOW_PROCESS_KEY,
      businessKey: request.id,
      variables: {
        requestId: request.id,
        submittedBy: request.submittedById,
        employeeGroup: "employees",
        supervisorGroup: "supervisors",
        financeGroup: "finance",
        totalAmount: Number(request.totalAmount),
        currency: request.currency,
        hasReceipts: request.hasReceipts,
        // Timer durations are process variables so the SLA is configurable and
        // testable without redeploying the process.
        managerReminderDuration: this.env.MANAGER_REMINDER_DURATION,
        managerEscalationDuration: this.env.MANAGER_ESCALATION_DURATION,
      },
    })

    await this.applyInstance(request.id, instance)
    await this.audit.record({
      entityType: "TravelRequest",
      entityId: request.id,
      requestId: request.id,
      action: "WORKFLOW_STARTED",
      data: { processInstanceId: instance.processInstanceId, activeTaskKeys: instance.activeTaskKeys },
    })
  }

  /**
   * Keeps the request's denormalized projection in sync with engine state so that
   * lists and dashboards never have to query the engine database.
   */
  async applyInstance(requestId: string, instance: WorkflowProcessInstance): Promise<void> {
    await this.prisma.travelRequest.update({
      where: { id: requestId },
      data: {
        workflowInstanceId: instance.processInstanceId,
        workflowStatus: instance.ended ? "ENDED" : "RUNNING",
        currentTaskKey: instance.activeTaskKeys[0] ?? null,
        status: deriveStatus(instance),
      },
    })
  }
}
