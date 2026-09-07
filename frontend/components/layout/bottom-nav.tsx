"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Lightbulb, Plus, CalendarDays, Settings } from "lucide-react"
import { PostWizard } from "@/components/post-wizard/post-wizard"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { label: "Home",     icon: LayoutDashboard, href: "/dashboard",      exact: true  },
  { label: "Ideas",    icon: Lightbulb,        href: "/content-ideas",  exact: false },
  { label: "Schedule", icon: CalendarDays,     href: "/schedule",       exact: false },
  { label: "Settings", icon: Settings,         href: "/settings",       exact: false },
] as const

export function BottomNav() {
  const pathname = usePathname()
  const [createOpen, setCreateOpen] = useState(false)

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <>
      {/* Nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center h-14">
          {/* Left two items */}
          {NAV_ITEMS.slice(0, 2).map((item) => {
            const active = isActive(item.href, item.exact)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="size-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          })}

          {/* Centre Create button */}
          <div className="flex flex-1 flex-col items-center justify-center">
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center justify-center w-12 h-12 -mt-5 rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95"
              aria-label="Create post"
            >
              <Plus className="size-5" />
            </button>
          </div>

          {/* Right two items */}
          {NAV_ITEMS.slice(2).map((item) => {
            const active = isActive(item.href, item.exact)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="size-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {createOpen && (
        <PostWizard platform="x" open onClose={() => setCreateOpen(false)} />
      )}
    </>
  )
}
