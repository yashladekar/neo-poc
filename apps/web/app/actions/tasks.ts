"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { apiFetch, apiUpload } from "@/lib/api"

export async function decideTaskAction(formData: FormData): Promise<void> {
  const taskId = String(formData.get("taskId") ?? "")
  const decision = String(formData.get("decision") ?? "")
  const comment = String(formData.get("comment") ?? "")
  const requestId = formData.get("requestId")

  if (!taskId || (decision !== "APPROVED" && decision !== "REJECTED")) {
    redirect("/tasks?error=invalid")
  }

  // The receipt sign-off attaches the signed document before the task completes.
  const receipt = formData.get("receipt")
  if (requestId && receipt instanceof File && receipt.size > 0) {
    const upload = new FormData()
    upload.set("file", receipt)
    await apiUpload(`/requests/${String(requestId)}/attachments`, upload)
  }

  await apiFetch(`/tasks/${taskId}/complete`, {
    method: "POST",
    body: { decision, comment: comment || undefined },
  })

  revalidatePath("/tasks")
  revalidatePath("/requests")
  revalidatePath("/")
  redirect(requestId ? `/requests/${String(requestId)}` : "/tasks")
}
