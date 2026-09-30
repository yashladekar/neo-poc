import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common"
import { ENV } from "../config/config.module"
import type { Env } from "../config/env"
import type { WorkflowHistoryEntry, WorkflowProcessInstance, WorkflowTask } from "./workflow.types"

@Injectable()
export class WorkflowClient {
  private readonly logger = new Logger(WorkflowClient.name)

  constructor(@Inject(ENV) private readonly env: Env) {}

  startProcess(input: {
    processDefinitionKey: string
    businessKey: string
    variables: Record<string, unknown>
  }): Promise<WorkflowProcessInstance> {
    return this.request<WorkflowProcessInstance>("POST", "/internal/process-instances", input)
  }

  getProcessInstance(processInstanceId: string): Promise<WorkflowProcessInstance> {
    return this.request<WorkflowProcessInstance>(
      "GET",
      `/internal/process-instances/${encodeURIComponent(processInstanceId)}`,
    )
  }

  getHistory(processInstanceId: string): Promise<WorkflowHistoryEntry[]> {
    return this.request<WorkflowHistoryEntry[]>(
      "GET",
      `/internal/process-instances/${encodeURIComponent(processInstanceId)}/history`,
    )
  }

  getTask(taskId: string): Promise<WorkflowTask> {
    return this.request<WorkflowTask>("GET", `/internal/tasks/${encodeURIComponent(taskId)}`)
  }

  completeTask(
    taskId: string,
    input: { userId: string; variables: Record<string, unknown> },
  ): Promise<WorkflowProcessInstance> {
    return this.request<WorkflowProcessInstance>(
      "POST",
      `/internal/tasks/${encodeURIComponent(taskId)}/complete`,
      input,
    )
  }

  claimTask(taskId: string, userId: string): Promise<WorkflowTask> {
    return this.request<WorkflowTask>("POST", `/internal/tasks/${encodeURIComponent(taskId)}/claim`, { userId })
  }

  /**
   * Tasks assigned to the user OR delegated to any of their groups. The engine
   * ANDs filters within one query, so each scope is queried separately and the
   * results are merged.
   */
  async listTasks(filters: {
    assignee?: string
    candidateGroups?: string[]
    processInstanceId?: string
  }): Promise<WorkflowTask[]> {
    const queries: Promise<WorkflowTask[]>[] = []
    if (filters.assignee) {
      queries.push(this.listTasksByGroup({ assignee: filters.assignee, processInstanceId: filters.processInstanceId }))
    }
    for (const group of filters.candidateGroups ?? []) {
      queries.push(
        this.listTasksByGroup({ candidateGroups: [group], processInstanceId: filters.processInstanceId }),
      )
    }
    if (queries.length === 0) {
      return []
    }

    const merged = new Map<string, WorkflowTask>()
    for (const task of (await Promise.all(queries)).flat()) {
      merged.set(task.taskId, task)
    }
    return Array.from(merged.values())
  }

  private async listTasksByGroup(filters: {
    assignee?: string
    candidateGroups?: string[]
    processInstanceId?: string
  }): Promise<WorkflowTask[]> {
    const params = new URLSearchParams()
    if (filters.assignee) {
      params.set("assignee", filters.assignee)
    }
    if (filters.candidateGroups && filters.candidateGroups.length === 1) {
      params.set("candidateGroup", filters.candidateGroups[0] as string)
    }
    if (filters.processInstanceId) {
      params.set("processInstanceId", filters.processInstanceId)
    }
    if (!params.has("assignee") && !params.has("candidateGroup") && !params.has("processInstanceId")) {
      return []
    }
    return this.request<WorkflowTask[]>("GET", `/internal/tasks?${params.toString()}`)
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.env.WORKFLOW_BASE_URL}${path}`
    let response: Response
    try {
      response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Token": this.env.WORKFLOW_INTERNAL_TOKEN,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      this.logger.error(`Workflow service unreachable: ${method} ${path}`, error as Error)
      throw new ServiceUnavailableException("Workflow service is unavailable")
    }

    if (!response.ok) {
      const text = await response.text()
      this.logger.warn(`Workflow call failed: ${method} ${path} -> ${response.status}`)
      throw workflowError(response.status, text)
    }

    if (response.status === 204) {
      return undefined as T
    }
    return (await response.json()) as T
  }
}

function extractDetail(body: string): string {
  try {
    const parsed = JSON.parse(body) as { detail?: string; message?: string; error?: string }
    return parsed.detail ?? parsed.message ?? parsed.error ?? body
  } catch {
    return body
  }
}

/**
 * Preserves the engine's own semantics: a missing task is a 404 and an
 * unauthorised action is a 403, not a generic "service unavailable". Only genuine
 * engine failures become 503.
 */
function workflowError(status: number, body: string): HttpException {
  const detail = extractDetail(body)
  switch (status) {
    case 400:
      return new BadRequestException(detail)
    case 401:
      return new UnauthorizedException(detail)
    case 403:
      return new ForbiddenException(detail)
    case 404:
      return new NotFoundException(detail)
    default:
      return new ServiceUnavailableException(`Workflow service error (${status}): ${detail}`)
  }
}
