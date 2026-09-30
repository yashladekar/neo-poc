import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
export type LoginInput = z.infer<typeof loginSchema>

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  groups: z.array(z.string()),
  permissions: z.array(z.string()),
})
export type SessionUser = z.infer<typeof sessionUserSchema>
