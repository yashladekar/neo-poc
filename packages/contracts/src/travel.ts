import { z } from "zod"

export const travelRequestStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "PENDING_MANAGER",
  "PENDING_FINANCE",
  "PENDING_EMPLOYEE",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
])
export type TravelRequestStatus = z.infer<typeof travelRequestStatusSchema>

export const travelCategorySchema = z.enum(["TRANSPORT", "LODGING", "MEALS", "OTHER"])
export type TravelCategory = z.infer<typeof travelCategorySchema>

export const travelRequestItemInputSchema = z.object({
  category: travelCategorySchema,
  description: z.string().min(1),
  amount: z.number().nonnegative(),
  incurredOn: z.string().optional(),
  receiptRequired: z.boolean().default(false),
})
export type TravelRequestItemInput = z.infer<typeof travelRequestItemInputSchema>

export const createTravelRequestSchema = z.object({
  title: z.string().min(3),
  purpose: z.string().max(2000).optional(),
  destination: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  currency: z.string().length(3).default("USD"),
  hasReceipts: z.boolean().default(false),
  items: z.array(travelRequestItemInputSchema).min(1),
})
export type CreateTravelRequestInput = z.infer<typeof createTravelRequestSchema>

export const travelRequestItemSchema = z.object({
  id: z.string(),
  category: travelCategorySchema,
  description: z.string(),
  amount: z.number(),
  incurredOn: z.string().nullable(),
  receiptRequired: z.boolean(),
})
export type TravelRequestItem = z.infer<typeof travelRequestItemSchema>

export const approvalDecisionSchema = z.object({
  id: z.string(),
  taskKey: z.string(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().nullable(),
  actorName: z.string(),
  decidedAt: z.string(),
})
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>

export const travelRequestSchema = z.object({
  id: z.string(),
  reference: z.string(),
  title: z.string(),
  purpose: z.string().nullable(),
  destination: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  totalAmount: z.number(),
  currency: z.string(),
  hasReceipts: z.boolean(),
  status: travelRequestStatusSchema,
  workflowStatus: z.string().nullable(),
  currentTaskKey: z.string().nullable(),
  bookingReference: z.string().nullable(),
  submittedBy: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  items: z.array(travelRequestItemSchema),
  decisions: z.array(approvalDecisionSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type TravelRequest = z.infer<typeof travelRequestSchema>
