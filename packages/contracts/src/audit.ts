import { z } from "zod"

export const auditEventSchema = z.object({
  id: z.string(),
  action: z.string(),
  actorId: z.string().nullable(),
  data: z.unknown().nullable(),
  createdAt: z.string(),
})
export type AuditEvent = z.infer<typeof auditEventSchema>

/** An activity instance from the engine's own history (ACT_HI_ACTINST). */
export const processHistoryEntrySchema = z.object({
  activityId: z.string(),
  activityName: z.string().nullable(),
  activityType: z.string(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
})
export type ProcessHistoryEntry = z.infer<typeof processHistoryEntrySchema>
