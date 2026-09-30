import { Prisma } from "@prisma/client"
import type { TravelRequest as TravelRequestDto } from "@workspace/contracts"

export type RequestWithRelations = Prisma.TravelRequestGetPayload<{
  include: {
    submittedBy: true
    items: true
    decisions: { include: { actor: true } }
  }
}>

function toDateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null
}

export function toTravelRequestDto(request: RequestWithRelations): TravelRequestDto {
  return {
    id: request.id,
    reference: request.reference,
    title: request.title,
    purpose: request.purpose,
    destination: request.destination,
    startDate: toDateOnly(request.startDate) ?? "",
    endDate: toDateOnly(request.endDate) ?? "",
    totalAmount: Number(request.totalAmount),
    currency: request.currency,
    hasReceipts: request.hasReceipts,
    status: request.status,
    workflowStatus: request.workflowStatus,
    currentTaskKey: request.currentTaskKey,
    bookingReference: request.bookingReference,
    submittedBy: {
      id: request.submittedBy.id,
      name: request.submittedBy.name,
      email: request.submittedBy.email,
    },
    items: request.items.map((item) => ({
      id: item.id,
      category: item.category,
      description: item.description,
      amount: Number(item.amount),
      incurredOn: toDateOnly(item.incurredOn),
      receiptRequired: item.receiptRequired,
    })),
    decisions: request.decisions.map((decision) => ({
      id: decision.id,
      taskKey: decision.taskKey,
      decision: decision.decision,
      comment: decision.comment,
      actorName: decision.actor.name,
      decidedAt: decision.decidedAt.toISOString(),
    })),
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  }
}

export const requestInclude = {
  submittedBy: true,
  items: true,
  decisions: { include: { actor: true } },
} satisfies Prisma.TravelRequestInclude
