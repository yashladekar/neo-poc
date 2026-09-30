export interface WorkflowProcessInstance {
  processInstanceId: string
  businessKey: string | null
  processDefinitionKey: string
  ended: boolean
  variables: Record<string, unknown>
  activeTaskKeys: string[]
}

export interface WorkflowTask {
  taskId: string
  name: string
  taskDefinitionKey: string
  processInstanceId: string
  processDefinitionKey: string
  businessKey: string | null
  assignee: string | null
  candidateGroups: string[]
  formKey: string | null
  variables: Record<string, unknown>
  createdTime: string
}

export interface WorkflowHistoryEntry {
  activityId: string
  activityName: string | null
  activityType: string
  startTime: string | null
  endTime: string | null
}
