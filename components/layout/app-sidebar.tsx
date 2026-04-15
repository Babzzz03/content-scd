"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Suspense } from "react"
import {
  LayoutDashboard,
  Lightbulb,
  Mic2,
  CalendarDays,
  Settings,
  Zap,
  TrendingUp,
  Newspaper,
  BookOpen,
  UserCircle,
  ChevronUp,
  PlayCircle,
} from "lucide-react"
import { useTour } from "@/lib/tour-context"
import { XIcon, LinkedInIcon, InstagramIcon } from "@/components/ui/platform-icons"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useUser, getInitials, PLAN_COLORS, PLAN_LABELS } from "@/lib/user-context"
import { cn } from "@/lib/utils"

const PLATFORM_ITEMS = [
  {
    id: "x",
    label: "X (Twitter)",
    icon: XIcon,
    href: "/x",
    color: "text-sky-500",
    scheduledCount: 3,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: LinkedInIcon,
    href: "/linkedin",
    color: "text-blue-600",
    scheduledCount: 2,
  },
  {
    id: "instagram",
    label: "Instagram",
    icon: InstagramIcon,
    href: "/instagram",
    color: "text-pink-500",
    scheduledCount: 5,
  },
]

const NAV_ITEMS = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    tourId: "nav-dashboard",
    exact: true,
  },
  {
    label: "Content Ideas",
    icon: Lightbulb,
    href: "/content-ideas",
    tourId: "nav-content-ideas",
  },
  {
    label: "Post Ideas",
    icon: Newspaper,
    href: "/post-ideas",
    tourId: "nav-post-ideas",
  },
  {
    label: "Brand Voice",
    icon: Mic2,
    href: "/brand-voice",
    tourId: "nav-brand-voice",
  },
  {
    label: "Schedule",
    icon: CalendarDays,
    href: "/schedule",
    tourId: "nav-schedule",
  },
  {
    label: "Marketing Strategy",
    icon: TrendingUp,
    href: "/marketing-strategy",
    tourId: "nav-marketing-strategy",
  },
  {
    label: "How It Works",
    icon: BookOpen,
    href: "/how-it-works",
    tourId: "nav-how-it-works",
  },
]

function AppSidebarInner() {
  const pathname = usePathname()
  const { user } = useUser()
  const { start: startTour } = useTour()

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <Sidebar>
      {/* Header */}
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="size-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-none">PostFlow</span>
            <span className="text-xs text-muted-foreground">AI Content Studio</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href, item.exact)}
                  >
                    <Link href={item.href} data-tour={item.tourId}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Platforms */}
        <SidebarGroup>
          <SidebarGroupLabel data-tour="nav-platforms">Platforms</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {PLATFORM_ITEMS.map((platform) => (
                <SidebarMenuItem key={platform.id}>
                  <SidebarMenuButton asChild isActive={isActive(platform.href)}>
                    <Link href={platform.href}>
                      <platform.icon className={platform.color} />
                      <span>{platform.label}</span>
                      {platform.scheduledCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="ml-auto text-xs"
                        >
                          {platform.scheduledCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild data-tour="nav-settings">
              <Link href="/settings">
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {/* Take a Tour button */}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={startTour} className="text-primary hover:text-primary hover:bg-primary/10">
              <PlayCircle />
              <span>Take a Tour</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* User area — dropdown with profile link */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 mt-1 hover:bg-sidebar-accent transition-colors text-left">
              <Avatar className="size-7 shrink-0">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-medium truncate">{user.name}</span>
                <span className="text-[10px] text-muted-foreground truncate">{user.email}</span>
              </div>
              <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56 mb-1">
            {/* Plan badge */}
            <div className="flex items-center gap-2 px-2 py-2 border-b mb-1">
              <Avatar className="size-8">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{user.name}</p>
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
            <DropdownMenuItem className="text-muted-foreground text-xs">
              Signed in as {user.email}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

export function AppSidebar() {
  return (
    <Suspense fallback={null}>
      <AppSidebarInner />
    </Suspense>
  )
}
