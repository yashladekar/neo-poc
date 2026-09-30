import type { SessionUser } from "@workspace/contracts"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { apiFetch } from "./api"
import { SESSION_COOKIE } from "./constants"

export async function getToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value
}

export async function getSession(): Promise<SessionUser | null> {
  const token = await getToken()
  if (!token) {
    return null
  }
  try {
    return await apiFetch<SessionUser>("/auth/me", { token })
  } catch {
    return null
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }
  return session
}
