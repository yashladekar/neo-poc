import { NextResponse, type NextRequest } from "next/server"

const SESSION_COOKIE = "neo_session"
const PUBLIC_PATHS = ["/login"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  const hasSession = request.cookies.has(SESSION_COOKIE)

  // Only gate unauthenticated access. We deliberately do NOT redirect away from
  // /login based on cookie presence: a stale/invalid token would otherwise bounce
  // between / and /login forever (the pages validate the session, the cookie may
  // be expired). Page-level checks handle the invalid-session case.
  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
