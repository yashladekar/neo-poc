import type { NotificationList } from "@workspace/contracts"
import { AppShell } from "@/components/app-shell"
import { apiFetch } from "@/lib/api"
import { requireSession } from "@/lib/session"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  let unread = 0
  try {
    unread = (await apiFetch<NotificationList>("/notifications")).unread
  } catch {
    unread = 0
  }
  return (
    <AppShell session={session} unread={unread}>
      {children}
    </AppShell>
  )
}
