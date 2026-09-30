import { Inject, Injectable, NotFoundException } from "@nestjs/common"
import { type TravelRequest, type TravelRequestStatus } from "@prisma/client"
import { ENV } from "../config/config.module"
import type { Env } from "../config/env"
import { AuditService } from "../audit/audit.service"
import { PrismaService } from "../prisma/prisma.service"

export const REQUEST_EVENTS = [
  "SUBMITTED",
  "RECEIPT_DOCUMENT_READY",
  "MANAGER_APPROVAL_REQUESTED",
  "MANAGER_REMINDER",
  "MANAGER_ESCALATION",
  "FINANCE_APPROVAL_REQUESTED",
  "FINAL_OUTCOME",
] as const

export type RequestEvent = (typeof REQUEST_EVENTS)[number]

interface NotifyInput {
  type: string
  title: string
  body: string
  userIds?: string[]
  groups?: string[]
}

@Injectable()
export class InternalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async evaluatePolicy(requestId: string): Promise<{ requiresFinance: boolean }> {
    const request = await this.prisma.travelRequest.findUnique({
      where: { id: requestId },
      select: { totalAmount: true },
    })
    if (!request) {
      throw new NotFoundException("Travel request not found")
    }
    return { requiresFinance: Number(request.totalAmount) > this.env.FINANCE_APPROVAL_THRESHOLD }
  }

  async handleEvent(requestId: string, event: RequestEvent): Promise<{ ok: boolean; event: string }> {
    const request = await this.requireRequest(requestId)
    const amount = `${request.currency} ${Number(request.totalAmount).toFixed(2)}`

    switch (event) {
      case "SUBMITTED":
        await this.setStatus(request, "SUBMITTED")
        break

      case "RECEIPT_DOCUMENT_READY":
        await this.setStatus(request, "PENDING_EMPLOYEE")
        await this.notify(request, {
          type: "RECEIPT_DOCUMENT_READY",
          title: `Sign your receipts for ${request.reference}`,
          body: `The receipt document for ${request.reference} is ready. Sign it and submit to continue.`,
          userIds: [request.submittedById],
        })
        break

      case "MANAGER_APPROVAL_REQUESTED":
        await this.setStatus(request, "PENDING_MANAGER")
        await this.notify(request, {
          type: "APPROVAL_REQUESTED",
          title: `Approval needed: ${request.reference}`,
          body: `${request.title} (${amount}) is waiting for your approval.`,
          groups: ["supervisors"],
        })
        break

      case "MANAGER_REMINDER":
        await this.notify(request, {
          type: "APPROVAL_REMINDER",
          title: `Reminder: ${request.reference} is still pending`,
          body: `${request.title} (${amount}) has been waiting for your approval.`,
          groups: ["supervisors"],
        })
        break

      case "MANAGER_ESCALATION":
        await this.notify(request, {
          type: "APPROVAL_ESCALATED",
          title: `Escalated: ${request.reference} breached its SLA`,
          body: `${request.title} (${amount}) was escalated because it was not approved in time.`,
          groups: ["supervisors", "finance"],
        })
        break

      case "FINANCE_APPROVAL_REQUESTED":
        await this.setStatus(request, "PENDING_FINANCE")
        await this.notify(request, {
          type: "FINANCE_APPROVAL_REQUESTED",
          title: `Finance review needed: ${request.reference}`,
          body: `${request.title} (${amount}) exceeds the auto-approval threshold.`,
          groups: ["finance"],
        })
        break

      case "FINAL_OUTCOME": {
        const approved = request.status === "COMPLETED"
        await this.notify(request, {
          type: approved ? "REQUEST_APPROVED" : "REQUEST_REJECTED",
          title: approved ? `${request.reference} was approved` : `${request.reference} was rejected`,
          body: approved
            ? `Your travel request ${request.title} (${amount}) was approved.`
            : `Your travel request ${request.title} (${amount}) was rejected.`,
          userIds: [request.submittedById],
        })
        break
      }

      default:
        break
    }

    await this.audit.record({
      entityType: "TravelRequest",
      entityId: requestId,
      requestId,
      action: `EVENT_${event}`,
      data: { event },
    })
    return { ok: true, event }
  }

  async finalize(requestId: string, decision: "APPROVED" | "REJECTED"): Promise<{ id: string; status: string }> {
    const status: TravelRequestStatus = decision === "APPROVED" ? "COMPLETED" : "REJECTED"
    await this.prisma.travelRequest.update({
      where: { id: requestId },
      data: { status, workflowStatus: "ENDED", currentTaskKey: null },
    })
    await this.audit.record({
      entityType: "TravelRequest",
      entityId: requestId,
      requestId,
      action: `WORKFLOW_${decision}`,
      data: { decision },
    })
    return { id: requestId, status }
  }

  private async requireRequest(requestId: string): Promise<TravelRequest> {
    const request = await this.prisma.travelRequest.findUnique({ where: { id: requestId } })
    if (!request) {
      throw new NotFoundException("Travel request not found")
    }
    return request
  }

  private async setStatus(request: TravelRequest, status: TravelRequestStatus): Promise<void> {
    await this.prisma.travelRequest.update({
      where: { id: request.id },
      data: { status, workflowStatus: "RUNNING" },
    })
  }

  private async notify(request: TravelRequest, input: NotifyInput): Promise<void> {
    const userIds = new Set(input.userIds ?? [])
    if (input.groups && input.groups.length > 0) {
      const memberships = await this.prisma.membership.findMany({
        where: { group: { key: { in: input.groups } } },
        select: { userId: true },
      })
      for (const membership of memberships) {
        userIds.add(membership.userId)
      }
    }
    if (userIds.size === 0) {
      return
    }
    // Idempotent: a retried service task must not duplicate notifications.
    const existing = await this.prisma.notification.findMany({
      where: { refId: request.id, type: input.type, userId: { in: Array.from(userIds) } },
      select: { userId: true },
    })
    const alreadyNotified = new Set(existing.map((row) => row.userId))
    const recipients = Array.from(userIds).filter((userId) => !alreadyNotified.has(userId))
    if (recipients.length === 0) {
      return
    }
    await this.prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        refType: "TravelRequest",
        refId: request.id,
      })),
    })
  }
}
