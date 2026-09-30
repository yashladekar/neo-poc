import type { TravelRequestStatus } from "@workspace/contracts"

const STATUS_LABELS: Record<TravelRequestStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PENDING_MANAGER: "Awaiting supervisor",
  PENDING_FINANCE: "Awaiting finance",
  PENDING_EMPLOYEE: "Awaiting employee",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as TravelRequestStatus] ?? status
}

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost"

export function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case "COMPLETED":
    case "APPROVED":
      return "default"
    case "REJECTED":
      return "destructive"
    case "PENDING_MANAGER":
    case "PENDING_FINANCE":
    case "PENDING_EMPLOYEE":
      return "secondary"
    default:
      return "outline"
  }
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date)
}

export function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

const AUDIT_LABELS: Record<string, string> = {
  SUBMITTED: "Request submitted",
  WORKFLOW_STARTED: "Workflow started",
  EVENT_SUBMITTED: "Workflow: submission recorded",
  EVENT_RECEIPT_DOCUMENT_READY: "Workflow: receipt document ready",
  EVENT_MANAGER_APPROVAL_REQUESTED: "Supervisor notified",
  EVENT_MANAGER_REMINDER: "Supervisor reminder sent",
  EVENT_MANAGER_ESCALATION: "Escalated (SLA breached)",
  EVENT_FINANCE_APPROVAL_REQUESTED: "Finance notified",
  EVENT_FINAL_OUTCOME: "Outcome notification sent",
  WORKFLOW_APPROVED: "Workflow approved",
  WORKFLOW_REJECTED: "Workflow rejected",
  TASK_APPROVED: "Task approved",
  TASK_REJECTED: "Task rejected",
}

export function auditLabel(action: string): string {
  return AUDIT_LABELS[action] ?? action
}
