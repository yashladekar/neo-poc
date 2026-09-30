import { z } from "zod"

export const notificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  read: z.boolean(),
  refType: z.string().nullable(),
  refId: z.string().nullable(),
  createdAt: z.string(),
})
export type Notification = z.infer<typeof notificationSchema>

export const notificationListSchema = z.object({
  items: z.array(notificationSchema),
  unread: z.number(),
})
export type NotificationList = z.infer<typeof notificationListSchema>
