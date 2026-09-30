import { z } from "zod"

/** One outbound call to an external system, recorded for traceability. */
export const integrationLogSchema = z.object({
  id: z.string(),
  provider: z.string(),
  operation: z.string(),
  status: z.enum(["SUCCESS", "FAILED"]),
  durationMs: z.number().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
})
export type IntegrationLog = z.infer<typeof integrationLogSchema>
