import type { TravelRequest } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import Link from "next/link"
import { LinkButton } from "@/components/link-button"
import { apiFetch } from "@/lib/api"
import { formatDate, formatMoney, statusLabel, statusVariant } from "@/lib/format"
import { requireSession } from "@/lib/session"

export default async function RequestsPage() {
  await requireSession()
  const requests = await apiFetch<TravelRequest[]>("/requests")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-medium">Travel requests</h1>
          <p className="text-sm text-muted-foreground">{requests.length} record(s) — the Appian “Travel Requests” record list.</p>
        </div>
        <LinkButton href="/requests/new">New travel request</LinkButton>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All requests</CardTitle>
          <CardDescription>Filtered by your authorisation.</CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No requests</EmptyTitle>
                <EmptyDescription>Nothing has been submitted yet.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Trip dates</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <Link className="font-medium underline-offset-4 hover:underline" href={`/requests/${request.id}`}>
                        {request.reference}
                      </Link>
                    </TableCell>
                    <TableCell>{request.title}</TableCell>
                    <TableCell>{request.destination}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(request.startDate)} → {formatDate(request.endDate)}
                    </TableCell>
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
