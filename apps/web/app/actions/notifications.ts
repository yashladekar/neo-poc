"use server"

import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "")
  if (!id) {
    return
  }
  await apiFetch(`/notifications/${id}/read`, { method: "POST" })
  revalidatePath("/notifications")
  revalidatePath("/")
}

export async function markAllNotificationsReadAction(): Promise<void> {
  await apiFetch("/notifications/read-all", { method: "POST" })
  revalidatePath("/notifications")
  revalidatePath("/")
}
