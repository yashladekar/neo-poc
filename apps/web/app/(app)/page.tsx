import type { Task, TravelRequest } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import Link from "next/link"
import { LinkButton } from "@/components/link-button"
import { apiFetch } from "@/lib/api"
import { formatDateTime, formatMoney, statusLabel, statusVariant } from "@/lib/format"
import { requireSession } from "@/lib/session"

const OPEN_STATUSES = ["SUBMITTED", "PENDING_MANAGER", "PENDING_FINANCE", "PENDING_EMPLOYEE"]

export default async function DashboardPage() {
  const session = await requireSession()
  const [requests, tasks] = await Promise.all([
    apiFetch<TravelRequest[]>("/requests"),
    apiFetch<Task[]>("/tasks"),
  ])

  const open = requests.filter((request) => OPEN_STATUSES.includes(request.status))
  const completed = requests.filter((request) => request.status === "COMPLETED")
  const spend = completed.reduce((sum, request) => sum + request.totalAmount, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-medium">Welcome, {session.name.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">
            {tasks.length > 0
              ? `You have ${tasks.length} task${tasks.length === 1 ? "" : "s"} waiting for you.`
              : "You have no tasks waiting."}
          </p>
        </div>
        <LinkButton href="/requests/new">New travel request</LinkButton>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Open requests", value: String(open.length) },
          { label: "Approved & completed", value: String(completed.length) },
          { label: "Approved spend", value: formatMoney(spend, "USD") },
        ].map((stat) => (
          <Card key={stat.label} size="sm">
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tasks waiting for you</CardTitle>
          <CardDescription>Human tasks assigned to you or your groups.</CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Nothing to do</EmptyTitle>
                <EmptyDescription>New approvals will appear here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Waiting since</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.name}</TableCell>
                    <TableCell>{task.request ? `${task.request.reference} · ${task.request.title}` : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(task.createdTime)}</TableCell>
                    <TableCell className="text-right">
                      <LinkButton href={`/tasks/${task.id}`} size="sm" variant="outline">
                        Open
                      </LinkButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent requests</CardTitle>
          <CardDescription>Travel requests you can see.</CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No requests yet</EmptyTitle>
                <EmptyDescription>Submit your first travel request to get started.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.slice(0, 8).map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <Link className="font-medium underline-offset-4 hover:underline" href={`/requests/${request.id}`}>
                        {request.reference}
                      </Link>
                    </TableCell>
                    <TableCell>{request.title}</TableCell>
                    <TableCell>{formatMoney(request.totalAmount, request.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(request.status)}>{statusLabel(request.status)}</Badge>
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
