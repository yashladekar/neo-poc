import type { Task } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"
import { ArrowLeft } from "lucide-react"
import { decideTaskAction } from "@/app/actions/tasks"
import { LinkButton } from "@/components/link-button"
import { ApiError, apiFetch } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { requireSession } from "@/lib/session"

/** A task the caller cannot see (completed, reassigned, or not authorised) is not an error page. */
async function loadTask(taskId: string): Promise<Task | null> {
  try {
    return await apiFetch<Task>(`/tasks/${encodeURIComponent(taskId)}`)
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      return null
    }
    throw error
  }
}

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  await requireSession()
  const { taskId } = await params
  const task = await loadTask(taskId)

  if (!task) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <LinkButton href="/tasks" variant="ghost" size="sm">
            <ArrowLeft /> Task inbox
          </LinkButton>
          <h1 className="font-heading text-xl font-medium">Task not available</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>This task is no longer open</CardTitle>
            <CardDescription>
              It may have been completed already, reassigned, or you may not have permission to act on it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LinkButton href="/tasks" variant="outline">
              Back to my tasks
            </LinkButton>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isEmployeeSignOff = task.taskKey === "employeeSignAndSubmit"
  const amount = task.variables.totalAmount
  const currency = task.variables.currency

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <LinkButton href="/tasks" variant="ghost" size="sm">
          <ArrowLeft /> Task inbox
        </LinkButton>
        <h1 className="font-heading text-xl font-medium">{task.name}</h1>
        <p className="text-sm text-muted-foreground">
          {task.request
            ? `For ${task.request.reference} · ${task.request.title} · ${String(currency ?? "")} ${String(amount ?? "")}`
            : task.processInstanceId}
        </p>
      </div>

      {task.request ? (
        <Card>
          <CardHeader>
            <CardTitle>Request summary</CardTitle>
            <CardDescription>Open the full record for expenses and history.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3 text-sm">
            <span>
              {task.request.reference} — {task.request.title}
            </span>
            <LinkButton href={`/requests/${task.request.id}`} variant="outline" size="sm">
              View request
            </LinkButton>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{isEmployeeSignOff ? "Submit signed receipts" : "Decision"}</CardTitle>
          <CardDescription>
            Task created {formatDateTime(task.createdTime)}
            {task.candidateGroups.length > 0 ? ` · candidates: ${task.candidateGroups.join(", ")}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={decideTaskAction} className="space-y-4">
            <input type="hidden" name="taskId" value={task.id} />
            {task.request ? <input type="hidden" name="requestId" value={task.request.id} /> : null}

            {isEmployeeSignOff ? (
              <div className="space-y-2">
                <Label htmlFor="receipt">Signed receipt document</Label>
                <input
                  id="receipt"
                  name="receipt"
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  className="block w-full rounded-lg border border-input bg-transparent p-1.5 text-sm file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-sm"
                />
                <p className="text-xs text-muted-foreground">PDF or image, up to 5 MB. Attached to the request.</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="comment">Comment</Label>
              <Textarea id="comment" name="comment" rows={3} placeholder="Add a note for the audit trail (optional)" />
            </div>

            <Separator />

            <div className="flex flex-wrap gap-2">
              {isEmployeeSignOff ? (
                <Button type="submit" name="decision" value="APPROVED">
                  Submit signed document
                </Button>
              ) : (
                <>
                  <Button type="submit" name="decision" value="APPROVED">
                    Approve
                  </Button>
                  <Button type="submit" name="decision" value="REJECTED" variant="destructive">
                    Reject
                  </Button>
                </>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
