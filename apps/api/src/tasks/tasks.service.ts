import { ForbiddenException, Injectable } from "@nestjs/common"
import type { DecisionInput, SessionUser, Task as TaskDto } from "@workspace/contracts"
import { AuditService } from "../audit/audit.service"
import { PrismaService } from "../prisma/prisma.service"
import { WorkflowClient } from "../workflow/workflow.client"
import { WorkflowStarter } from "../workflow/workflow-starter.service"
import type { WorkflowTask } from "../workflow/workflow.types"
import { toTaskDto, type RequestRef } from "./tasks.mapper"

const READ_ALL_PERMISSION = "request:read:all"

export interface CompleteTaskResult {
  requestId: string | null
  ended: boolean
  activeTaskKeys: string[]
  decision: string
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: WorkflowClient,
    private readonly starter: WorkflowStarter,
    private readonly audit: AuditService,
  ) {}

  async listForUser(user: SessionUser): Promise<TaskDto[]> {
    const tasks = await this.workflow.listTasks({ assignee: user.id, candidateGroups: user.groups })
    const requestMap = await this.loadRequests(tasks)
    return tasks.map((task) => toTaskDto(task, this.requestFor(task, requestMap)))
  }

  async getForUser(user: SessionUser, taskId: string): Promise<TaskDto> {
    const task = await this.workflow.getTask(taskId)
    this.assertCanAct(user, task)
    const requestMap = await this.loadRequests([task])
    return toTaskDto(task, this.requestFor(task, requestMap))
  }

  async complete(user: SessionUser, taskId: string, input: DecisionInput): Promise<CompleteTaskResult> {
    const task = await this.workflow.getTask(taskId)
    this.assertCanAct(user, task)

    const instance = await this.workflow.completeTask(taskId, {
      userId: user.id,
      variables: {
        decision: input.decision === "APPROVED" ? "APPROVED" : "REJECTED",
        approved: input.decision === "APPROVED",
        comment: input.comment ?? null,
        decidedBy: user.id,
        ...(input.variables ?? {}),
      },
    })

    const requestId = task.businessKey
    if (requestId) {
      await this.starter.applyInstance(requestId, instance)
      await this.prisma.approvalDecision.create({
        data: {
          requestId,
          taskId,
          taskKey: task.taskDefinitionKey,
          decision: input.decision,
          comment: input.comment ?? null,
          actorId: user.id,
        },
      })
      await this.audit.record({
        entityType: "TravelRequest",
        entityId: requestId,
        requestId,
        actorId: user.id,
        action: `TASK_${input.decision}`,
        data: { taskKey: task.taskDefinitionKey, taskId, comment: input.comment ?? null },
      })
    }

    return {
      requestId,
      ended: instance.ended,
      activeTaskKeys: instance.activeTaskKeys,
      decision: input.decision,
    }
  }

  private assertCanAct(user: SessionUser, task: WorkflowTask): void {
    const isAssignee = task.assignee !== null && task.assignee === user.id
    const isCandidate = task.candidateGroups.some((group) => user.groups.includes(group))
    const canReadAll = user.permissions.includes(READ_ALL_PERMISSION)
    if (!isAssignee && !isCandidate && !canReadAll) {
      throw new ForbiddenException("You are not allowed to act on this task")
    }
  }

  private async loadRequests(tasks: WorkflowTask[]): Promise<Map<string, RequestRef>> {
    const ids = Array.from(new Set(tasks.map((task) => task.businessKey).filter((id): id is string => Boolean(id))))
    if (ids.length === 0) {
      return new Map()
    }
    const requests = await this.prisma.travelRequest.findMany({
      where: { id: { in: ids } },
      select: { id: true, reference: true, title: true, status: true },
    })
    return new Map(requests.map((request) => [request.id, request]))
  }

  private requestFor(task: WorkflowTask, requestMap: Map<string, RequestRef>): RequestRef | null {
    if (!task.businessKey) {
      return null
    }
    return requestMap.get(task.businessKey) ?? null
  }
}
