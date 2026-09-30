import type { Task } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import Link from "next/link"
import { LinkButton } from "@/components/link-button"
import { apiFetch } from "@/lib/api"
import { formatDateTime, statusLabel, statusVariant } from "@/lib/format"
import { requireSession } from "@/lib/session"

export default async function TasksPage() {
  const session = await requireSession()
  const tasks = await apiFetch<Task[]>("/tasks")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-medium">My tasks</h1>
        <p className="text-sm text-muted-foreground">
          Human tasks delegated to you or your groups ({session.groups.join(", ")}).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Task inbox</CardTitle>
          <CardDescription>The Appian task list, sourced live from Flowable.</CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Inbox empty</EmptyTitle>
                <EmptyDescription>You have no open tasks.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Request status</TableHead>
                  <TableHead>Waiting since</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.name}</TableCell>
                    <TableCell>
                      {task.request ? (
                        <Link className="underline-offset-4 hover:underline" href={`/requests/${task.request.id}`}>
                          {task.request.reference}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {task.request ? (
                        <Badge variant={statusVariant(task.request.status)}>{statusLabel(task.request.status)}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(task.createdTime)}</TableCell>
                    <TableCell className="text-right">
                      <LinkButton href={`/tasks/${task.id}`} size="sm">
                        Review
                      </LinkButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
