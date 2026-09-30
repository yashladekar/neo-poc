import { apiRaw } from "@/lib/api"

export const dynamic = "force-dynamic"

// Streams a stored attachment through the BFF so the browser never needs the
// session cookie or direct access to the API.
export async function GET(
  _request: Request,
  context: { params: Promise<{ attachmentId: string }> },
): Promise<Response> {
  const { attachmentId } = await context.params
  const upstream = await apiRaw(`/attachments/${encodeURIComponent(attachmentId)}/download`)

  if (upstream.status === 401 || upstream.status === 403 || upstream.status === 404) {
    return new Response("Attachment not available", { status: upstream.status })
  }
  if (!upstream.ok || !upstream.body) {
    return new Response("Attachment not available", { status: 502 })
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": upstream.headers.get("content-disposition") ?? "attachment",
      "Cache-Control": "private, no-store",
    },
  })
}
