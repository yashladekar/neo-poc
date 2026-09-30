import type { NotificationList } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/notifications"
import { LinkButton } from "@/components/link-button"
import { apiFetch } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { requireSession } from "@/lib/session"

export default async function NotificationsPage() {
  await requireSession()
  const { items, unread } = await apiFetch<NotificationList>("/notifications")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-medium">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread` : "You are all caught up."}
          </p>
        </div>
        {unread > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="outline" size="sm">
              Mark all as read
            </Button>
          </form>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>News</CardTitle>
          <CardDescription>Appian “News” equivalent — every workflow event that concerns you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No notifications</EmptyTitle>
                <EmptyDescription>Approval requests and outcomes will show up here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            items.map((notification) => (
              <div
                key={notification.id}
                className={
                  notification.read
                    ? "rounded-lg border p-3"
                    : "rounded-lg border border-primary/30 bg-primary/5 p-3"
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{notification.title}</span>
                  {!notification.read ? <Badge>New</Badge> : null}
                  <span className="text-xs text-muted-foreground">{formatDateTime(notification.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                <div className="mt-2 flex items-center gap-2">
                  {notification.refId ? (
                    <LinkButton href={`/requests/${notification.refId}`} variant="outline" size="xs">
                      View request
                    </LinkButton>
                  ) : null}
                  {!notification.read ? (
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="id" value={notification.id} />
                      <Button type="submit" variant="ghost" size="xs">
                        Mark read
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
