"use client"

import Link from "next/link"
import { Settings, UserCircle, LogOut, PlayCircle } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUser, getInitials, PLAN_COLORS, PLAN_LABELS } from "@/lib/user-context"
import { useTour } from "@/lib/tour-context"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export function AppHeader() {
  const { user } = useUser()
  const { start: startTour } = useTour()

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
      {/* Left: sidebar trigger + brand */}
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <span className="text-sm text-muted-foreground">PostFlow</span>
      </div>

      {/* Right: tour button + user avatar */}
      <div className="flex items-center gap-2">
        {/* Tour trigger — visible on mobile (sidebar hidden), hidden on desktop (sidebar has it) */}
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden h-8 gap-1.5 text-xs text-primary hover:text-primary hover:bg-primary/10"
          onClick={startTour}
          aria-label="Take a tour"
        >
          <PlayCircle className="size-3.5" />
          <span className="hidden sm:inline">Tour</span>
        </Button>

      {/* Right: user avatar dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="size-7 cursor-pointer ring-2 ring-transparent hover:ring-primary/40 transition-all">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
              <AvatarFallback className="text-[11px] font-bold bg-primary text-primary-foreground">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          {/* User info header */}
          <div className="flex items-center gap-2.5 px-2 py-2.5 border-b mb-1">
            <Avatar className="size-8 shrink-0">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
              <AvatarFallback className="text-xs font-bold bg-primary text-primary-foreground">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">{user.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
              <Badge className={cn("text-[9px] h-4 px-1.5 mt-0.5", PLAN_COLORS[user.plan])}>
                {PLAN_LABELS[user.plan]}
              </Badge>
            </div>
          </div>

          <DropdownMenuItem asChild>
            <Link href="/profile" className="flex items-center gap-2">
              <UserCircle className="size-3.5" />
              View Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings" className="flex items-center gap-2">
              <Settings className="size-3.5" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-muted-foreground"
            onClick={() => toast.info("Sign out — no auth backend in prototype")}
          >
            <LogOut className="size-3.5 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  )
}
