"use server"

import { createTravelRequestSchema } from "@workspace/contracts"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { apiFetch } from "@/lib/api"

export async function createRequestAction(formData: FormData): Promise<void> {
  let payload: unknown
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}"))
  } catch {
    redirect("/requests/new?error=invalid")
  }

  const parsed = createTravelRequestSchema.safeParse(payload)
  if (!parsed.success) {
    redirect("/requests/new?error=validation")
  }

  const created = await apiFetch<{ id: string }>("/requests", {
    method: "POST",
    body: parsed.data,
  })

  revalidatePath("/requests")
  revalidatePath("/")
  redirect(`/requests/${created.id}`)
}
