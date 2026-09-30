"use client"

import { cn } from "@workspace/ui/lib/utils"
import { Bell, FileText, LayoutDashboard, ListChecks } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/requests", label: "Travel requests", icon: FileText },
  { href: "/tasks", label: "My tasks", icon: ListChecks },
  { href: "/notifications", label: "Notifications", icon: Bell, badgeKey: "unread" as const },
]

export function NavLinks({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1">
      {LINKS.map(({ href, label, icon: Icon, badgeKey }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span className="flex-1">{label}</span>
            {badgeKey === "unread" && unread > 0 ? (
              <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{unread}</span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
