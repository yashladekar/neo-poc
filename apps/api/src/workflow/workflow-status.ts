import type { TravelRequestStatus } from "@workspace/contracts"
import type { WorkflowProcessInstance } from "./workflow.types"

const TASK_STATUS: Record<string, TravelRequestStatus> = {
  managerApproval: "PENDING_MANAGER",
  financeApproval: "PENDING_FINANCE",
  employeeSignAndSubmit: "PENDING_EMPLOYEE",
  smokeApproval: "PENDING_MANAGER",
}

export function deriveStatus(instance: WorkflowProcessInstance): TravelRequestStatus {
  if (!instance.ended) {
    for (const taskKey of instance.activeTaskKeys) {
      const status = TASK_STATUS[taskKey]
      if (status) {
        return status
      }
    }
    return "SUBMITTED"
  }

  const decision = instance.variables?.decision
  if (decision === "REJECTED") {
    return "REJECTED"
  }
  if (decision === "APPROVED") {
    return "COMPLETED"
  }
  return "SUBMITTED"
}
