"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Subscribes to the server-sent notification stream and refreshes the server
 * components whenever the workflow changes state. Replaces client-side polling.
 */
export function LiveUpdates() {
  const router = useRouter()

  useEffect(() => {
    const source = new EventSource("/api/live")
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { changed?: boolean }
        if (payload.changed) {
          router.refresh()
        }
      } catch {
        // ignore malformed frames
      }
    }
    return () => source.close()
  }, [router])

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Live workflow updates">
      <span className="size-1.5 rounded-full bg-emerald-500" />
      Live
    </span>
  )
}
