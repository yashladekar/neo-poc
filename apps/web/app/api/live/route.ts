import { apiRaw } from "@/lib/api"

export const dynamic = "force-dynamic"

// Proxies the API's SSE stream to the browser (same-origin, cookie stays server-side).
export async function GET(): Promise<Response> {
  const upstream = await apiRaw("/notifications/stream")

  if (upstream.status === 401) {
    return new Response("Unauthorized", { status: 401 })
  }
  if (!upstream.ok || !upstream.body) {
    return new Response("Live stream unavailable", { status: 502 })
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
