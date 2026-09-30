import type { Task as TaskDto } from "@workspace/contracts"
import type { WorkflowTask } from "../workflow/workflow.types"

export interface RequestRef {
  id: string
  reference: string
  title: string
  status: string
}

export function toTaskDto(task: WorkflowTask, request: RequestRef | null): TaskDto {
  return {
    id: task.taskId,
    name: task.name,
    taskKey: task.taskDefinitionKey,
    processInstanceId: task.processInstanceId,
    formKey: task.formKey,
    assignee: task.assignee,
    candidateGroups: task.candidateGroups,
    createdTime: task.createdTime,
    variables: task.variables ?? {},
    request,
  }
}
