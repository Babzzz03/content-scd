"use client"

import { useState, useRef, useCallback } from "react"
import {
  UserCircle,
  Camera,
  Save,
  Bell,
  CreditCard,
  Trash2,
  LogOut,
  ShieldAlert,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  useUser,
  getInitials,
  PLAN_LABELS,
  PLAN_COLORS,
  TIMEZONES,
} from "@/lib/user-context"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const PLAN_FEATURES = {
  free: ["5 scheduled posts", "1 platform", "Basic AI generation"],
  pro: ["Unlimited posts", "All 3 platforms", "Advanced AI", "Brand Voice", "Analytics"],
  enterprise: ["Everything in Pro", "Team seats", "Priority support", "Custom integrations"],
}

export default function ProfilePage() {
  const { user, updateUser } = useUser()

  // Form draft state
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [bio, setBio] = useState(user.bio)
  const [timezone, setTimezone] = useState(user.timezone)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatarUrl)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [saved, setSaved] = useState(false)

  // Notification state (live — saves immediately via toggle)
  const [notifyScheduled, setNotifyScheduled] = useState(user.notifyScheduled)
  const [notifyPublished, setNotifyPublished] = useState(user.notifyPublished)
  const [notifyFailed, setNotifyFailed] = useState(user.notifyFailed)

  // Password change
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }, [])

  const handleSaveProfile = () => {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    if (!email.trim() || !email.includes("@")) {
      toast.error("A valid email is required")
      return
    }
    updateUser({ name, email, bio, timezone, avatarUrl: avatarPreview })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    toast.success("Profile saved!")
  }

  const handleNotifyToggle = (field: "notifyScheduled" | "notifyPublished" | "notifyFailed", val: boolean) => {
    if (field === "notifyScheduled") setNotifyScheduled(val)
    if (field === "notifyPublished") setNotifyPublished(val)
    if (field === "notifyFailed") setNotifyFailed(val)
    updateUser({ [field]: val })
    toast.success("Notification preference updated")
  }

  const handleChangePassword = () => {
    if (!currentPassword) { toast.error("Enter your current password"); return }
    if (newPassword.length < 8) { toast.error("New password must be at least 8 characters"); return }
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return }
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    toast.success("Password updated successfully")
  }

  const isDirty =
    name !== user.name ||
    email !== user.email ||
    bio !== user.bio ||
    timezone !== user.timezone ||
    avatarPreview !== user.avatarUrl

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Page header */}
      <div className="sticky top-0 z-10 bg-background flex items-center gap-3 px-4 py-4 sm:px-6 sm:py-5 border-b">
        <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <UserCircle className="size-4 sm:size-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-semibold leading-tight">My Profile</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your account details, preferences, and plan
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-5xl">
        <div className="grid grid-cols-1 gap-5 sm:gap-8 lg:grid-cols-2 lg:gap-6">

          {/* ── Left column ──────────────────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Avatar + basic info */}
            <section className="rounded-xl border bg-card p-5 space-y-5">
              <h2 className="text-sm font-semibold">Profile Information</h2>

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <Avatar className="size-16">
                    {avatarPreview && <AvatarImage src={avatarPreview} alt={name} />}
                    <AvatarFallback className="text-lg font-bold bg-primary text-primary-foreground">
                      {getInitials(name || "?")}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Camera className="size-4 text-white" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={handleAvatarChange}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-primary hover:underline mt-1"
                  >
                    Change photo
                  </button>
                  {avatarPreview && (
                    <button
                      onClick={() => { setAvatarPreview(null); setAvatarFile(null) }}
                      className="text-xs text-muted-foreground hover:text-destructive ml-3"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="profile-name">Display Name</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name or brand name"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="profile-email">Email Address</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              {/* Bio */}
              <div className="space-y-1.5">
                <Label htmlFor="profile-bio">
                  Bio{" "}
                  <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="profile-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A short description about you or your brand…"
                  rows={3}
                  className="resize-none text-sm"
                />
              </div>

              {/* Timezone */}
              <div className="space-y-1.5">
                <Label htmlFor="profile-timezone">Timezone</Label>
                <select
                  id="profile-timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Used to display and schedule posts at the right local time
                </p>
              </div>

              <Button
                className="w-full"
                onClick={handleSaveProfile}
                disabled={!isDirty && !avatarFile}
              >
                {saved ? (
                  <><Check className="size-3.5 mr-1.5" />Saved</>
                ) : (
                  <><Save className="size-3.5 mr-1.5" />Save Changes</>
                )}
              </Button>
            </section>

            {/* Password */}
            <section className="rounded-xl border bg-card p-5 space-y-4">
              <h2 className="text-sm font-semibold">Change Password</h2>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                  />
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleChangePassword}
                  disabled={!currentPassword || !newPassword || !confirmPassword}
                >
                  Update Password
                </Button>
              </div>
            </section>
          </div>

          {/* ── Right column ─────────────────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Plan & Billing */}
            <section className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Plan & Billing</h2>
                <Badge className={cn("text-[11px] font-semibold", PLAN_COLORS[user.plan])}>
                  {PLAN_LABELS[user.plan]}
                </Badge>
              </div>

              <div className="rounded-lg bg-muted/40 border p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Your plan includes
                </p>
                <ul className="space-y-1.5">
                  {PLAN_FEATURES[user.plan].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="size-3.5 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="text-xs text-muted-foreground">
                Member since{" "}
                <span suppressHydrationWarning className="font-medium text-foreground">
                  {user.joinedAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </span>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                {user.plan !== "enterprise" && (
                  <Button className="w-full" size="sm">
                    <CreditCard className="size-3.5 mr-1.5" />
                    {user.plan === "free" ? "Upgrade to Pro" : "Upgrade to Enterprise"}
                  </Button>
                )}
                {user.plan !== "free" && (
                  <Button variant="outline" size="sm" className="w-full text-muted-foreground">
                    Manage Billing
                  </Button>
                )}
              </div>
            </section>

            {/* Notifications */}
            <section className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Notifications</h2>
              </div>

              <div className="space-y-3">
                {[
                  {
                    key: "notifyScheduled" as const,
                    label: "Post scheduled",
                    desc: "When a post is queued for publishing",
                    value: notifyScheduled,
                  },
                  {
                    key: "notifyPublished" as const,
                    label: "Post published",
                    desc: "When a post goes live successfully",
                    value: notifyPublished,
                  },
                  {
                    key: "notifyFailed" as const,
                    label: "Post failed",
                    desc: "When a post fails to publish",
                    value: notifyFailed,
                  },
                ].map(({ key, label, desc, value }) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={value}
                      onCheckedChange={(v) => handleNotifyToggle(key, v)}
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Danger zone */}
            <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-destructive" />
                <h2 className="text-sm font-semibold text-destructive">Danger Zone</h2>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Sign out</p>
                    <p className="text-xs text-muted-foreground">
                      Sign out of your PostFlow account
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast.info("Sign out clicked — no auth backend in prototype")}
                  >
                    <LogOut className="size-3.5 mr-1.5" />
                    Sign Out
                  </Button>
                </div>

                <Separator className="border-destructive/20" />

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Delete account</p>
                    <p className="text-xs text-muted-foreground">
                      Permanently remove your account and all data
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => toast.error("This would permanently delete your account")}
                  >
                    <Trash2 className="size-3.5 mr-1.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  )
}
