import type { Attachment, AuditEvent, IntegrationLog, ProcessHistoryEntry, TravelRequest } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { ArrowLeft } from "lucide-react"
import { LinkButton } from "@/components/link-button"
import { ApiError, apiFetch } from "@/lib/api"
import { auditLabel, formatDate, formatDateTime, formatMoney, statusLabel, statusVariant } from "@/lib/format"
import { requireSession } from "@/lib/session"

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession()
  const { id } = await params

  try {
    return await renderRequest(id)
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      return (
        <div className="space-y-6">
          <div className="space-y-1">
            <LinkButton href="/requests" variant="ghost" size="sm">
              <ArrowLeft /> All requests
            </LinkButton>
            <h1 className="font-heading text-xl font-medium">Request not available</h1>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>You cannot view this request</CardTitle>
              <CardDescription>It may not exist, or it belongs to someone else.</CardDescription>
            </CardHeader>
            <CardContent>
              <LinkButton href="/requests" variant="outline">
                Back to travel requests
              </LinkButton>
            </CardContent>
          </Card>
        </div>
      )
    }
    throw error
  }
}

async function renderRequest(id: string) {
  const [request, audit, history, attachments, integrations] = await Promise.all([
    apiFetch<TravelRequest>(`/requests/${id}`),
    apiFetch<AuditEvent[]>(`/requests/${id}/audit`),
    apiFetch<ProcessHistoryEntry[]>(`/requests/${id}/history`),
    apiFetch<Attachment[]>(`/requests/${id}/attachments`),
    apiFetch<IntegrationLog[]>(`/requests/${id}/integrations`),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <LinkButton href="/requests" variant="ghost" size="sm">
            <ArrowLeft /> All requests
          </LinkButton>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-xl font-medium">{request.reference}</h1>
            <Badge variant={statusVariant(request.status)}>{statusLabel(request.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{request.title}</p>
        </div>
        {request.status.startsWith("PENDING_") ? (
          <LinkButton href="/tasks" variant="outline">
            Go to my tasks
          </LinkButton>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Destination", value: request.destination },
          { label: "Trip dates", value: `${formatDate(request.startDate)} → ${formatDate(request.endDate)}` },
          { label: "Total", value: formatMoney(request.totalAmount, request.currency) },
          { label: "Receipts required", value: request.hasReceipts ? "Yes" : "No" },
          ...(request.bookingReference ? [{ label: "Booking", value: request.bookingReference }] : []),
        ].map((field) => (
          <Card key={field.label} size="sm">
            <CardHeader>
              <CardDescription>{field.label}</CardDescription>
              <CardTitle>{field.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {request.purpose ? (
        <Card>
          <CardHeader>
            <CardTitle>Purpose</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{request.purpose}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Expense items</CardTitle>
          <CardDescription>Raised by {request.submittedBy.name} on {formatDateTime(request.createdAt)}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {request.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-muted-foreground">{item.receiptRequired ? "Required" : "—"}</TableCell>
                  <TableCell className="text-right">{formatMoney(item.amount, request.currency)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatMoney(request.totalAmount, request.currency)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Approval history</CardTitle>
          <CardDescription>Every decision recorded against this request.</CardDescription>
        </CardHeader>
        <CardContent>
          {request.decisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No decisions recorded yet.</p>
          ) : (
            <ol className="space-y-3">
              {request.decisions.map((decision) => (
                <li key={decision.id} className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant={decision.decision === "APPROVED" ? "default" : "destructive"}>
                      {decision.decision}
                    </Badge>
                    <span className="font-medium">{decision.actorName}</span>
                    <span className="text-muted-foreground">· {decision.taskKey}</span>
                    <span className="text-muted-foreground">· {formatDateTime(decision.decidedAt)}</span>
                  </div>
                  {decision.comment ? <p className="text-sm text-muted-foreground">{decision.comment}</p> : null}
                  <Separator />
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>Audit trail shared between the workflow engine and the application.</CardDescription>
        </CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit events yet.</p>
          ) : (
            <ol className="space-y-2">
              {audit.map((event) => (
                <li key={event.id} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{formatDateTime(event.createdAt)}</span>
                  <span>·</span>
                  <span>{auditLabel(event.action)}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Process history</CardTitle>
          <CardDescription>Activity instances recorded by the Flowable engine (ACT_HI_ACTINST).</CardDescription>
        </CardHeader>
        <CardContent>
          {history.filter((entry) => entry.activityType !== "sequenceFlow").length === 0 ? (
            <p className="text-sm text-muted-foreground">No engine history yet.</p>
          ) : (
            <ol className="space-y-2">
              {history
                .filter((entry) => entry.activityType !== "sequenceFlow")
                .map((entry, index) => (
                  <li key={`${entry.activityId}-${index}`} className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline">{entry.activityType}</Badge>
                    <span className="font-medium">{entry.activityName ?? entry.activityId}</span>
                    <span className="text-muted-foreground">
                      {entry.endTime
                        ? `${formatDateTime(entry.startTime ?? "")} → ${formatDateTime(entry.endTime)}`
                        : entry.startTime
                          ? `started ${formatDateTime(entry.startTime)} · active`
                          : "—"}
                    </span>
                  </li>
                ))}
            </ol>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Attachments</CardTitle>
          <CardDescription>Documents attached while the workflow ran.</CardDescription>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attachments yet.</p>
          ) : (
            <ul className="space-y-2">
              {attachments.map((attachment) => (
                <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="font-medium">{attachment.name}</span>{" "}
                    <span className="text-muted-foreground">
                      · {(attachment.size / 1024).toFixed(0)} KB · {attachment.uploadedByName} ·{" "}
                      {formatDateTime(attachment.createdAt)}
                    </span>
                  </span>
                  <a
                    className="underline underline-offset-4"
                    href={`/api/attachments/${attachment.id}`}
                    download={attachment.name}
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Outbound calls made by the workflow (Appian integration objects).</CardDescription>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No integrations called yet.</p>
          ) : (
            <ul className="space-y-2">
              {integrations.map((log) => (
                <li key={log.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={log.status === "SUCCESS" ? "default" : "destructive"}>{log.status}</Badge>
                  <span className="font-medium">{log.provider}</span>
                  <span className="text-muted-foreground">{log.operation}</span>
                  {log.durationMs !== null ? (
                    <span className="text-muted-foreground">{log.durationMs} ms</span>
                  ) : null}
                  <span className="text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
