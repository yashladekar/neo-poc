import { z } from "zod"

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(28800),
  WORKFLOW_BASE_URL: z.url().default("http://localhost:8081"),
  WORKFLOW_INTERNAL_TOKEN: z.string().min(1),
  WORKFLOW_PROCESS_KEY: z.string().default("travelRequestApproval"),
  FINANCE_APPROVAL_THRESHOLD: z.coerce.number().nonnegative().default(1000),
  MANAGER_REMINDER_DURATION: z.string().default("PT48H"),
  MANAGER_ESCALATION_DURATION: z.string().default("PT120H"),
  RECONCILIATION_INTERVAL_SECONDS: z.coerce.number().int().nonnegative().default(15),
  STORAGE_DIR: z.string().default("./storage"),
  WEB_ORIGIN: z.url().default("http://localhost:3000"),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors)
    throw new Error("Invalid environment configuration")
  }
  return parsed.data
}
