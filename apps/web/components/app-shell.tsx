import type { SessionUser } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { Plane } from "lucide-react"
import { logoutAction } from "@/app/actions/auth"
import { LiveUpdates } from "./live-updates"
import { NavLinks } from "./nav-links"

export function AppShell({
  session,
  unread,
  children,
}: {
  session: SessionUser
  unread: number
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-muted/20 md:flex">
        <div className="flex items-center justify-between px-4 py-4">
          <span className="flex items-center gap-2">
            <Plane className="size-5" />
            <span className="font-heading text-sm font-medium">TravelDesk</span>
          </span>
          <LiveUpdates />
        </div>
        <Separator />
        <div className="flex-1 p-3">
          <NavLinks unread={unread} />
        </div>
        <Separator />
        <div className="space-y-3 p-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">{session.name}</div>
            <div className="text-xs text-muted-foreground">{session.email}</div>
          </div>
          <div className="flex flex-wrap gap-1">
            {session.groups.map((group) => (
              <Badge key={group} variant="outline">
                {group}
              </Badge>
            ))}
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-5xl p-6">{children}</div>
      </main>
    </div>
  )
}
