import type {
  FlyerTemplate,
  ScheduledPost,
  ContentIdea,
  BrandVoice,
  PlatformStats,
  ConnectedAccount,
} from "@/lib/types"

// ─── Flyer Templates ──────────────────────────────────────────────────────────
export const FLYER_TEMPLATES: FlyerTemplate[] = [
  {
    id: "flyer-breaking",
    name: "Breaking Expose",
    description: "Dark dramatic image with bold bottom headline and badge",
    hasImageSlot: true,
    hasTextSlot: true,
    imageSlotHint: "Upload a dramatic editorial or news-style photo",
    style: "dark",
    aspectRatio: "4:5",
    previewBg: "from-zinc-900 to-zinc-800",
    layout: "breaking",
    accentColor: "#ffffff",
    categoryLabel: "EXCLUSIVE",
    demoText: "AI Deepfake Scammer Gets Exposed After Being Asked To Hold 3 Fingers",
    previewAnchor: "bottom",
  },
  {
    id: "flyer-color-pop",
    name: "Color Pop",
    description: "Dark image with vibrant accent headline and carousel dots",
    hasImageSlot: true,
    hasTextSlot: true,
    imageSlotHint: "Upload a crowd shot, event photo, or dynamic scene",
    style: "bold",
    aspectRatio: "4:5",
    previewBg: "from-zinc-900 to-zinc-800",
    layout: "color-pop",
    accentColor: "#22c55e",
    categoryLabel: "TECHNOLOGY",
    demoText: "Good News From Around The World That Nobody Is Talking About",
    previewAnchor: "center",
  },
  {
    id: "flyer-editorial",
    name: "Clean Editorial",
    description: "Light minimal layout with centered text and accent line",
    hasImageSlot: true,
    hasTextSlot: true,
    imageSlotHint: "Upload a clean, well-lit product or lifestyle photo",
    style: "minimal",
    aspectRatio: "1:1",
    previewBg: "from-slate-50 to-slate-100",
    layout: "editorial",
    accentColor: "#3b82f6",
    categoryLabel: "FEATURED",
    demoText: "Hack Club Certificates You Should Earn As A STEM Student",
    previewAnchor: "center",
  },
  {
    id: "flyer-impact",
    name: "Bold Impact",
    description: "Dark photo with large accent-colored emphasis and supporting text",
    hasImageSlot: true,
    hasTextSlot: true,
    imageSlotHint: "Upload a group shot, portrait, or dark-background product photo",
    style: "bold",
    aspectRatio: "4:5",
    previewBg: "from-zinc-900 to-black",
    layout: "impact",
    accentColor: "#f59e0b",
    categoryLabel: "EXCLUSIVE",
    demoText: "3 Founders, 22 Years Old, Built $10B AI Startup And Became Youngest Billionaires",
    previewAnchor: "bottom",
  },
  {
    id: "flyer-dramatic",
    name: "Tinted Drama",
    description: "Color-graded image overlay with left-aligned bottom headline",
    hasImageSlot: true,
    hasTextSlot: true,
    imageSlotHint: "Upload a portrait or dramatic close-up face shot",
    style: "dark",
    aspectRatio: "4:5",
    previewBg: "from-red-900 to-zinc-900",
    layout: "dramatic",
    accentColor: "#ef4444",
    tintColor: "rgba(150, 20, 20, 0.55)",
    categoryLabel: "Ai",
    demoText: "Sam Altman's Coworkers Say He Can Barely Code And Misunderstands Basic Machine Learning",
    previewAnchor: "bottom",
  },
  {
    id: "flyer-badge",
    name: "Badge Category",
    description: "Dark image with colored category pill and bold uppercase title",
    hasImageSlot: true,
    hasTextSlot: true,
    imageSlotHint: "Upload a portrait, lifestyle, or promotional photo",
    style: "bold",
    aspectRatio: "4:5",
    previewBg: "from-zinc-800 to-zinc-900",
    layout: "badge",
    accentColor: "#eab308",
    categoryLabel: "BUSINESS",
    demoText: "Ryan Reynolds' Investment Portfolio Is Legendary",
    previewAnchor: "bottom",
  },
  {
    id: "flyer-gradient",
    name: "Gradient Flow",
    description: "Rich gradient background with centered headline — no image needed",
    hasImageSlot: false,
    hasTextSlot: true,
    style: "gradient",
    aspectRatio: "1:1",
    previewBg: "from-violet-600 to-indigo-700",
    layout: "gradient-text",
    accentColor: "#a5b4fc",
    categoryLabel: "INSIGHT",
    demoText: "The Future of AI Is Already Here And Nobody Is Ready",
    previewAnchor: "center",
  },
  {
    id: "flyer-story",
    name: "Story Impact",
    description: "Full-screen 9:16 vertical story with bold bottom headline",
    hasImageSlot: true,
    hasTextSlot: true,
    imageSlotHint: "Upload a vertical photo of a person, scene, or dramatic moment",
    style: "bold",
    aspectRatio: "9:16",
    previewBg: "from-cyan-600 to-blue-700",
    layout: "story",
    accentColor: "#06b6d4",
    categoryLabel: "STORY",
    demoText: "Everything Changes When You See This",
    previewAnchor: "bottom",
  },
]

// ─── Scheduled Posts ──────────────────────────────────────────────────────────
export const DUMMY_SCHEDULED_POSTS: ScheduledPost[] = [
  {
    id: "post-1",
    platform: "instagram",
    postType: "single",
    content: "Transform your morning routine with these 5 simple habits 🌅",
    caption:
      "Start your day right. Swipe to see all 5 habits. Which one will you try first? #MorningRoutine #Productivity #Wellness",
    imageUrl: "/placeholder-image.jpg",
    hashtags: ["#MorningRoutine", "#Productivity", "#Wellness", "#HealthyLiving"],
    scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    status: "scheduled",
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
  },
  {
    id: "post-2",
    platform: "x",
    postType: "thread",
    content:
      "🧵 Thread: Here's everything I've learned about building an audience from 0 to 10k in 6 months...",
    hashtags: ["#BuildInPublic", "#CreatorEconomy"],
    scheduledAt: new Date(Date.now() + 5 * 60 * 60 * 1000), // 5 hours from now
    status: "scheduled",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: "post-3",
    platform: "linkedin",
    postType: "text",
    content:
      "The biggest mistake I made as a first-time founder was not talking to customers early enough. Here's what I learned...",
    hashtags: ["#Entrepreneurship", "#StartupLife", "#Founder"],
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
    status: "scheduled",
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
  },
  {
    id: "post-4",
    platform: "instagram",
    postType: "carousel",
    content: "5 design principles every creator should know",
    caption: "Save this for later! Which principle do you already use? 👇",
    hashtags: ["#DesignTips", "#CreativeLife", "#VisualContent"],
    scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 2 days
    status: "draft",
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
  },
  {
    id: "post-5",
    platform: "linkedin",
    postType: "image",
    content: "Excited to share a major milestone — we just hit 1,000 customers! 🎉",
    hashtags: ["#Milestone", "#Grateful", "#Growth"],
    scheduledAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // already published
    status: "published",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
]

// ─── Content Ideas ────────────────────────────────────────────────────────────
export const DUMMY_CONTENT_IDEAS: ContentIdea[] = [
  {
    id: "idea-1",
    type: "skit",
    title: "The Client Who Changes the Brief",
    description:
      "A relatable skit showing a freelancer or agency receiving constant brief changes from a demanding client. Ends with a comedic twist where the client approves the original idea.",
    script:
      "Scene 1: Designer presents initial mockup. Client: 'Love it! Just... change everything.'\nScene 2: Designer returns with revision. Client: 'Hmm, can we go back to what we had before?'\nScene 3: Designer presents ORIGINAL design. Client: 'PERFECT! This is exactly what I wanted!'",
    visualDirection: "Office setting, two characters — a tired designer and an enthusiastic client",
    suggestedCaption: "Every designer has lived this moment 😭 Tag a client who's done this to you 👇",
    platforms: ["instagram", "x"],
    estimatedDuration: "30-45 seconds",
    callToAction: "Tag someone who needs to see this",
    props: ["Laptop", "Coffee mug", "Stack of printed designs"],
  },
  {
    id: "idea-2",
    type: "educational",
    title: "3 Social Media Mistakes Killing Your Reach",
    description:
      "An educational carousel or short video breaking down the top 3 mistakes brands make on social media, with actionable fixes for each.",
    visualDirection: "Clean slides with bold text, icons, and before/after examples",
    suggestedCaption:
      "Are you making mistake #2? Most brands don't even realize it. Save this post so you don't forget! 🔖",
    platforms: ["instagram", "linkedin"],
    estimatedDuration: "60 seconds or 5-slide carousel",
    callToAction: "Save + Share with your team",
    props: ["Graphic design software", "Brand examples"],
  },
  {
    id: "idea-3",
    type: "behind-the-scenes",
    title: "A Day in the Life: Running the Brand",
    description:
      "Raw, authentic behind-the-scenes content showing what actually goes into running the brand — the early mornings, the decisions, the small wins.",
    visualDirection: "Handheld camera feel, natural lighting, candid moments",
    suggestedCaption: "Nobody shows you the messy middle. Here's ours 🎬",
    platforms: ["instagram", "x"],
    estimatedDuration: "60-90 seconds",
    callToAction: "Comment your biggest daily struggle",
    props: ["Workspace setup", "Products", "Team members (optional)"],
  },
  {
    id: "idea-4",
    type: "verbal",
    title: "Unpopular Opinion: Why Less Content Wins",
    description:
      "A talking-head style video sharing a counterintuitive take — that posting less but more strategically outperforms high-volume posting.",
    script:
      "Hook (0-3s): 'Everyone tells you to post more. They're wrong.'\nBody (3-45s): Share 3 data points or personal evidence supporting the claim.\nClose (45-60s): 'Quality over quantity. Here's the strategy I'd use instead...'",
    visualDirection: "Direct-to-camera, minimal background, confident and conversational",
    suggestedCaption: "Controversial? Maybe. But the numbers don't lie. What do you think? 👇",
    platforms: ["x", "linkedin"],
    estimatedDuration: "60 seconds",
    callToAction: "Reply with your take",
  },
  {
    id: "idea-5",
    type: "testimonial",
    title: "Customer Story: From Zero to Results",
    description:
      "Feature a real or dramatized customer journey — their challenge before finding your brand, and the transformation after.",
    visualDirection: "Split screen: before vs after, or a warm interview-style setup",
    suggestedCaption: "Real results. Real people. This is why we do what we do 💛",
    platforms: ["instagram", "linkedin"],
    estimatedDuration: "45-90 seconds",
    callToAction: "Share your own story in the comments",
    props: ["Interview location or recorded testimonial"],
  },
  {
    id: "idea-6",
    type: "trending",
    title: "React to a Trending Moment in Your Niche",
    description:
      "Jump on a current trending topic, meme, or news story relevant to your industry and give your unique brand perspective on it.",
    visualDirection: "Fast-paced, on-trend edit style matching the current viral format",
    suggestedCaption: "We had to say something 🗣️ #[TrendingHashtag]",
    platforms: ["instagram", "x"],
    estimatedDuration: "15-30 seconds",
    callToAction: "Agree or disagree? Drop it below",
  },
]

// ─── Brand Voice ─────────────────────────────────────────────────────────────
export const DUMMY_BRAND_VOICE: BrandVoice = {
  id: "brand-1",
  brandName: "Nova Studio",
  industry: "Creative Agency / Digital Marketing",
  tagline: "Ideas that move people",
  description:
    "Nova Studio is a creative agency helping entrepreneurs and growing brands build a powerful digital presence. We offer social media strategy, content production, brand identity design, and AI-powered content tools. Our flagship product, PostFlow, lets creators schedule, compose, and generate platform-specific content with AI assistance — saving hours every week while maintaining an authentic, on-brand voice.",
  targetAudience:
    "Entrepreneurs, small business owners, and growing brands aged 25–45 who want to level up their digital presence",
  tone: ["professional", "inspirational", "bold"],
  keyMessages: [
    "Creativity is a competitive advantage",
    "Your story is worth telling — we help you tell it right",
    "Data-driven strategy meets authentic storytelling",
  ],
  competitors: ["Hootsuite", "Buffer", "Later"],
  styleNotes:
    "Avoid overly corporate language. Speak like a brilliant friend who happens to be a marketing expert. Use em dashes, short punchy sentences, and occasional rhetorical questions.",
  primaryColor: "#6366f1",
  secondaryColor: "#f59e0b",
  createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
}

// ─── Platform Stats ───────────────────────────────────────────────────────────
export const DUMMY_PLATFORM_STATS: PlatformStats[] = [
  {
    platform: "x",
    scheduledCount: 3,
    draftCount: 1,
    publishedThisWeek: 7,
    engagementRate: "4.2%",
  },
  {
    platform: "linkedin",
    scheduledCount: 2,
    draftCount: 2,
    publishedThisWeek: 4,
    engagementRate: "6.8%",
  },
  {
    platform: "instagram",
    scheduledCount: 5,
    draftCount: 3,
    publishedThisWeek: 9,
    engagementRate: "3.1%",
  },
]

// ─── Connected Accounts ───────────────────────────────────────────────────────
export const DUMMY_CONNECTED_ACCOUNTS: ConnectedAccount[] = [
  {
    platform: "x",
    connected: false,
  },
  {
    platform: "linkedin",
    connected: false,
  },
  {
    platform: "instagram",
    connected: false,
  },
]
