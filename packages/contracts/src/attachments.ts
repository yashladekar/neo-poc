import { z } from "zod"

export const attachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  contentType: z.string(),
  size: z.number(),
  uploadedByName: z.string(),
  createdAt: z.string(),
})
export type Attachment = z.infer<typeof attachmentSchema>
