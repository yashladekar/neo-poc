import { cookies } from "next/headers"
import { API_BASE_URL, SESSION_COOKIE } from "./constants"

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
  token?: string
}

async function resolveToken(explicit?: string): Promise<string | undefined> {
  if (explicit) {
    return explicit
  }
  return (await cookies()).get(SESSION_COOKIE)?.value
}

/**
 * Server-side call to the NestJS application layer. The session cookie never
 * leaves the server: the browser only ever talks to this Next.js app.
 */
export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = await resolveToken(options.token)
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new ApiError(response.status, await response.text())
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

/** Multipart upload (attachments). Content-Type is set by fetch from the FormData. */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = await resolveToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {},
    body: formData,
    cache: "no-store",
  })
  if (!response.ok) {
    throw new ApiError(response.status, await response.text())
  }
  return (await response.json()) as T
}

/** Unparsed upstream response, for streaming (downloads, SSE). */
export async function apiRaw(path: string): Promise<Response> {
  const token = await resolveToken()
  return fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {},
    cache: "no-store",
  })
}
