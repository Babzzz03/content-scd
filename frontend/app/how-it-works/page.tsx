"use client"

import {
  BookOpen,
  Zap,
  UserCheck,
  Mic2,
  Lightbulb,
  Newspaper,
  CalendarDays,
  MessageSquareReply,
  TrendingUp,
  Bot,
  Globe,
  Key,
  Sparkles,
  Clock,
  Send,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Info,
} from "lucide-react"
import { XIcon, LinkedInIcon, InstagramIcon } from "@/components/ui/platform-icons"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

// ── Data ──────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Mic2,
    title: "Brand Voice",
    href: "#brand-voice",
    color: "bg-violet-500/10 text-violet-500",
  },
  {
    icon: Lightbulb,
    title: "Content Ideas",
    href: "#content-ideas",
    color: "bg-yellow-500/10 text-yellow-500",
  },
  {
    icon: Newspaper,
    title: "Post Ideas",
    href: "#post-ideas",
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    icon: CalendarDays,
    title: "Schedule",
    href: "#schedule",
    color: "bg-green-500/10 text-green-500",
  },
  {
    icon: MessageSquareReply,
    title: "Reply & Engage",
    href: "#automation",
    color: "bg-orange-500/10 text-orange-500",
  },
  {
    icon: TrendingUp,
    title: "Marketing Strategy",
    href: "#marketing-strategy",
    color: "bg-pink-500/10 text-pink-500",
  },
  {
    icon: Bot,
    title: "AI Providers",
    href: "#ai-providers",
    color: "bg-sky-500/10 text-sky-500",
  },
]

const GETTING_STARTED_STEPS = [
  {
    number: "01",
    title: "Connect Your Accounts",
    description:
      "Go to Settings → Connected Accounts. Each platform uses a session cookie to authenticate — no password is ever stored. Follow the step-by-step DevTools guide inside the app to grab your cookie.",
    icon: UserCheck,
    tip: "Use the PostFlow Browser Extension to capture cookies in one click without opening DevTools.",
  },
  {
    number: "02",
    title: "Set Up Your Brand Voice",
    description:
      "Navigate to Brand Voice and fill in your brand name, industry, target audience, tone, and a short description. PostFlow uses this context whenever generating content so every piece sounds like you.",
    icon: Mic2,
  },
  {
    number: "03",
    title: "Pick an AI Provider",
    description:
      "Go to Settings → AI Providers and paste in your API key for Claude, ChatGPT, or Gemini. Activate the one you want — only one provider is used at a time. All content generation calls go through your key.",
    icon: Bot,
  },
  {
    number: "04",
    title: "Generate & Schedule",
    description:
      "Use Post Ideas or Content Ideas to generate ready-to-publish content. Review, tweak, and hit Schedule — or press Post Now if you're ready to go live immediately.",
    icon: Send,
  },
]

const PLATFORM_COOKIES = [
  { platform: "X / Twitter", icon: XIcon, cookie: "auth_token", color: "text-sky-500" },
  { platform: "LinkedIn", icon: LinkedInIcon, cookie: "li_at", color: "text-blue-600" },
  { platform: "Instagram", icon: InstagramIcon, cookie: "sessionid", color: "text-pink-500" },
]

const WIZARD_STEPS = [
  { step: "1", label: "Post Type", desc: "Choose single post, thread, carousel, image, or story." },
  { step: "2", label: "AI Input", desc: "Describe the topic or paste your idea. AI drafts the content." },
  { step: "3", label: "Design", desc: "Pick a visual style, colour palette, and layout direction." },
  { step: "4", label: "Media", desc: "Upload images or videos, or let AI suggest a prompt." },
  { step: "5", label: "Preview & Schedule", desc: "Review the final post, set a date/time, and confirm." },
]

// ── Section wrapper ───────────────────────────────────────────────────────────
interface SectionProps {
  id: string
  icon: React.ElementType
  iconClass: string
  title: string
  subtitle: string
  children: React.ReactNode
}

function Section({ id, icon: Icon, iconClass, title, subtitle, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-6">
      <div className="flex items-center gap-3 mb-6">
        <div className={cn("flex size-10 items-center justify-center rounded-xl", iconClass)}>
          <Icon className="size-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

// ── Step card ─────────────────────────────────────────────────────────────────
function StepCard({
  number,
  title,
  description,
  icon: Icon,
  tip,
}: {
  number: string
  title: string
  description: string
  icon: React.ElementType
  tip?: string
}) {
  return (
    <div className="relative flex gap-5">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-primary font-bold text-sm">
          {number}
        </div>
        <div className="w-px flex-1 bg-border mt-2" />
      </div>
      <div className="pb-8 flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="size-4 text-primary shrink-0" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        {tip && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2">
            <Info className="size-3.5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">{tip}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Feature chip ──────────────────────────────────────────────────────────────
function FeatureChip({
  icon: Icon,
  title,
  href,
  color,
}: {
  icon: React.ElementType
  title: string
  href: string
  color: string
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
    >
      <div className={cn("flex size-6 items-center justify-center rounded-md", color)}>
        <Icon className="size-3.5" />
      </div>
      {title}
      <ArrowRight className="size-3 ml-auto text-muted-foreground" />
    </a>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HowItWorksPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Hero */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-4 sm:px-6 sm:py-5 flex items-center gap-3">
        <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Zap className="size-4 sm:size-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-semibold leading-tight">How It Works</h1>
          <p className="text-xs text-muted-foreground mt-0.5">PostFlow workflow guide</p>
        </div>
      </div>
      <div className="relative overflow-hidden border-b bg-linear-to-br from-primary/5 via-background to-background px-4 py-8 sm:px-6 sm:py-10">
        <div className="max-w-3xl">
          <div className="flex size-10 sm:size-12 items-center justify-center rounded-2xl bg-primary mb-4">
            <Zap className="size-5 sm:size-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">How PostFlow Works</h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl leading-relaxed">
            PostFlow is an AI-powered social media studio that helps you generate, schedule, and
            automate content across X, LinkedIn, and Instagram — all in one place.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            {FEATURES.map((f) => (
              <a
                key={f.title}
                href={f.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-accent",
                  f.color
                )}
              >
                <f.icon className="size-3" />
                {f.title}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 sm:py-10 space-y-10 sm:space-y-14">

        {/* ── Getting Started ── */}
        <Section
          id="getting-started"
          icon={CheckCircle2}
          iconClass="bg-primary/10 text-primary"
          title="Getting Started"
          subtitle="Four steps to go from zero to publishing"
        >
          <div>
            {GETTING_STARTED_STEPS.map((s) => (
              <StepCard key={s.number} {...s} />
            ))}
          </div>
        </Section>

        <Separator />

        {/* ── Connecting Accounts ── */}
        <Section
          id="connecting-accounts"
          icon={Key}
          iconClass="bg-amber-500/10 text-amber-500"
          title="Connecting Your Accounts"
          subtitle="How PostFlow authenticates without storing passwords"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              PostFlow uses the same session cookie approach pioneered by automation tools like
              PhantomBuster. When you log in to a social platform, the browser stores a session
              cookie that proves you're authenticated. PostFlow captures that cookie and uses it
              to act on your behalf — no password, no OAuth app approval required.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PLATFORM_COOKIES.map(({ platform, icon: PIcon, cookie, color }) => (
                <div
                  key={platform}
                  className="rounded-xl border bg-card p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <PIcon className={cn("size-4 shrink-0", color)} />
                    <span className="text-sm font-medium">{platform}</span>
                  </div>
                  <div className="rounded-md bg-muted px-3 py-1.5">
                    <code className="text-xs font-mono text-muted-foreground">{cookie}</code>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">Browser Extension (Recommended)</h3>
                <Badge variant="secondary" className="text-[10px]">Easiest</Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Install the PostFlow Chrome Extension. While logged in to each platform, click the
                extension icon and hit <strong>Capture Cookies</strong>. It reads the session
                cookie directly from Chrome's cookie store and copies it to your clipboard — no
                DevTools needed.
              </p>
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                <Info className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                  Session cookies expire when you log out. If automation stops working, reconnect
                  your account by capturing a fresh cookie.
                </p>
              </div>
            </div>
          </div>
        </Section>

        <Separator />

        {/* ── Brand Voice ── */}
        <Section
          id="brand-voice"
          icon={Mic2}
          iconClass="bg-violet-500/10 text-violet-500"
          title="Brand Voice"
          subtitle="Teach PostFlow how your brand sounds"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your Brand Voice is a profile that gets sent to the AI along with every content
              request. It ensures that generated posts, captions, and strategies always match your
              tone — not a generic AI voice.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "Brand Name", desc: "Your company or personal brand name." },
                { label: "Industry", desc: "The sector you operate in." },
                { label: "Target Audience", desc: "Who you're trying to reach." },
                { label: "Tone", desc: "Professional, casual, bold, educational…" },
                { label: "Brand Description", desc: "A short paragraph about what you do." },
                { label: "Sample Content", desc: "Existing posts to help the AI mimic your style." },
              ].map(({ label, desc }) => (
                <div key={label} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                  <CheckCircle2 className="size-4 text-violet-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Separator />

        {/* ── Content Ideas ── */}
        <Section
          id="content-ideas"
          icon={Lightbulb}
          iconClass="bg-yellow-500/10 text-yellow-500"
          title="Content Ideas"
          subtitle="Video content briefs for creators building a brand"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Content Ideas is built for creators who want to grow their brand through long-form
              video — YouTube, TikTok, Reels. It generates fully scoped video briefs including a
              hook, scene breakdown, script outline, B-roll suggestions, and a visual image prompt.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: Sparkles, label: "AI-generated hook", desc: "Grabs attention in the first 3 seconds." },
                { icon: BarChart3, label: "Scene breakdown", desc: "Ordered scenes with talking points per scene." },
                { icon: Lightbulb, label: "Script outline", desc: "Structured talking-point list for the full video." },
                { icon: Send, label: "B-roll suggestions", desc: "Stock footage and visual cut ideas." },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                  <Icon className="size-4 text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Separator />

        {/* ── Post Ideas ── */}
        <Section
          id="post-ideas"
          icon={Newspaper}
          iconClass="bg-blue-500/10 text-blue-500"
          title="Post Ideas"
          subtitle="Ready-to-schedule social media posts"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Post Ideas generates platform-native posts (tweets, LinkedIn articles, Instagram
              captions) based on your topic, tone, and brand voice. Each idea comes with a title,
              caption, hashtags, and an optional image prompt.
            </p>
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold">Post Creation Wizard</h3>
              <p className="text-xs text-muted-foreground">
                Clicking Schedule or Post Now on any idea opens the 5-step wizard pre-filled with
                the AI content — you only need to review and confirm.
              </p>
              <div className="space-y-2">
                {WIZARD_STEPS.map(({ step, label, desc }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold">
                      {step}
                    </div>
                    <div>
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground ml-2">{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Separator />

        {/* ── Schedule ── */}
        <Section
          id="schedule"
          icon={CalendarDays}
          iconClass="bg-green-500/10 text-green-500"
          title="Schedule"
          subtitle="Visual calendar for all your planned posts"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Schedule page shows every post across all platforms on a monthly calendar. You
              can see exactly what's going out and when, spot gaps, and manage posts without
              leaving this view.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  icon: Clock,
                  label: "Reschedule",
                  desc: "Pick a new date/time for any pending post.",
                  color: "text-green-500",
                },
                {
                  icon: Newspaper,
                  label: "Edit",
                  desc: "Reopen the wizard to change content, media, or design.",
                  color: "text-blue-500",
                },
                {
                  icon: Sparkles,
                  label: "Duplicate",
                  desc: "Clone a post and push it 1 hour later as a draft.",
                  color: "text-violet-500",
                },
                {
                  icon: CalendarDays,
                  label: "New Post",
                  desc: "Open the wizard directly from the calendar.",
                  color: "text-primary",
                },
              ].map(({ icon: Icon, label, desc, color }) => (
                <div key={label} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                  <Icon className={cn("size-4 shrink-0 mt-0.5", color)} />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Separator />

        {/* ── Reply & Engage Automation ── */}
        <Section
          id="automation"
          icon={MessageSquareReply}
          iconClass="bg-orange-500/10 text-orange-500"
          title="Reply & Engage Automation"
          subtitle="Simulate AI-driven interactions on your posts"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Reply Composer and Engage Composer let you configure automated interaction
              campaigns. Set a target (post URL, hashtag, or audience), define behaviour rules,
              and hit Start — PostFlow will simulate the automation and show you a live activity
              log.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquareReply className="size-4 text-orange-500" />
                  <h3 className="text-sm font-semibold">Reply Composer</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Automatically reply to comments or mentions on your posts. Useful for community
                  management — set tone, reply style, and which keywords to trigger on.
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="size-4 text-orange-500" />
                  <h3 className="text-sm font-semibold">Engage Composer</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Proactively engage with posts from target accounts or around specific topics.
                  Like, comment, or follow to grow your reach organically.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 py-2">
              <Info className="size-3.5 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-600 dark:text-orange-400 leading-relaxed">
                Automation uses your saved session cookie to authenticate. Make sure your account
                is connected in Settings before starting a campaign.
              </p>
            </div>
          </div>
        </Section>

        <Separator />

        {/* ── Marketing Strategy ── */}
        <Section
          id="marketing-strategy"
          icon={TrendingUp}
          iconClass="bg-pink-500/10 text-pink-500"
          title="Marketing Strategy"
          subtitle="AI-generated growth plans tailored to your brand"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Marketing Strategy page combines your brand voice with custom inputs — business
              stage, goals, budget, and timeline — to generate a full growth strategy. Each
              strategy includes a positioning statement, content pillars, platform-specific
              tactics, recommended tools, and a phased action plan.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: "Positioning Statement", desc: "One-sentence brand differentiator." },
                { label: "Content Pillars", desc: "3–5 core themes to post about consistently." },
                { label: "Platform Tactics", desc: "Platform-specific tips for X, LinkedIn, Instagram." },
                { label: "Tool Recommendations", desc: "Specific apps and services to support growth." },
                { label: "Phased Action Plan", desc: "Week-by-week or month-by-month milestones." },
                { label: "KPIs", desc: "Metrics to track your progress." },
              ].map(({ label, desc }) => (
                <div key={label} className="rounded-lg border bg-card p-3 space-y-0.5">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Separator />

        {/* ── AI Providers ── */}
        <Section
          id="ai-providers"
          icon={Bot}
          iconClass="bg-sky-500/10 text-sky-500"
          title="AI Providers"
          subtitle="Bring your own API key — choose your AI"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              PostFlow is model-agnostic. Add your API key for Claude (Anthropic), ChatGPT
              (OpenAI), or Gemini (Google) in Settings → AI Providers. You can only have one
              provider active at a time. All generation requests go through your key, so you
              control the cost and usage.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  name: "Claude",
                  by: "Anthropic",
                  color: "bg-orange-500/10 text-orange-600",
                  note: "Strong at nuanced, brand-aligned writing.",
                },
                {
                  name: "ChatGPT",
                  by: "OpenAI",
                  color: "bg-green-500/10 text-green-600",
                  note: "Great general-purpose content and long-form.",
                },
                {
                  name: "Gemini",
                  by: "Google",
                  color: "bg-blue-500/10 text-blue-600",
                  note: "Fast multimodal generation with image support.",
                },
              ].map(({ name, by, color, note }) => (
                <div key={name} className="rounded-xl border bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{name}</span>
                    <Badge variant="secondary" className={cn("text-[10px]", color)}>
                      {by}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{note}</p>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-sky-500/10 border border-sky-500/20 px-3 py-2">
              <Info className="size-3.5 text-sky-500 shrink-0 mt-0.5" />
              <p className="text-xs text-sky-600 dark:text-sky-400 leading-relaxed">
                No API key? PostFlow falls back to mock generation so you can explore the full
                interface without any setup.
              </p>
            </div>
          </div>
        </Section>

        {/* Footer CTA */}
        <div className="rounded-2xl border bg-linear-to-br from-primary/5 to-background p-8 text-center space-y-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary mx-auto">
            <Zap className="size-6 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-bold">Ready to get started?</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Connect your first account and generate your first post in under 5 minutes.
          </p>
          <div className="flex gap-3 justify-center flex-wrap pt-1">
            <a
              href="/settings"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Key className="size-3.5" />
              Connect Accounts
            </a>
            <a
              href="/post-ideas"
              className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Sparkles className="size-3.5" />
              Generate Post Ideas
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}
