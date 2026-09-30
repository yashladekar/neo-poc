"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { API_BASE_URL, SESSION_COOKIE } from "@/lib/constants"

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  })

  if (!response.ok) {
    redirect("/login?error=invalid")
  }

  const setCookie = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))
  const token = setCookie?.split(";", 1)[0]?.split("=", 2)[1]
  if (!token) {
    redirect("/login?error=invalid")
  }

  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  })

  redirect("/")
}

export async function logoutAction(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  redirect("/login")
}
