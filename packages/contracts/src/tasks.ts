import { z } from "zod"

export const taskRequestRefSchema = z.object({
  id: z.string(),
  reference: z.string(),
  title: z.string(),
  status: z.string(),
})

export const taskSchema = z.object({
  id: z.string(),
  name: z.string(),
  taskKey: z.string(),
  processInstanceId: z.string(),
  formKey: z.string().nullable(),
  assignee: z.string().nullable(),
  candidateGroups: z.array(z.string()),
  createdTime: z.string(),
  variables: z.record(z.string(), z.unknown()),
  request: taskRequestRefSchema.nullable(),
})
export type Task = z.infer<typeof taskSchema>

export const decisionInputSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().max(2000).optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
})
export type DecisionInput = z.infer<typeof decisionInputSchema>
