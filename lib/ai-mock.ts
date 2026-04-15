import type {
  PostWizardState,
  GeneratedPostContent,
  FlyerContent,
  ContentIdeasInput,
  ContentIdea,
  ReplyComposerInput,
  GeneratedReply,
  EngageComposerInput,
  GeneratedEngagement,
  ContentTone,
  ContentIdeaType,
  MarketingStrategyInput,
  MarketingStrategy,
  AIProviderID,
  PostIdea,
  PostIdeasInput,
} from "@/lib/types"

// Simulate API delay
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ─── Provider logger ──────────────────────────────────────────────────────────
// In a real implementation these functions would route to the selected provider's
// SDK (Anthropic, Google GenAI, or OpenAI). Here we log the intent clearly.
function logProvider(fn: string, provider: AIProviderID | null) {
  if (provider) {
    console.log(`[AI MOCK] ${fn} → would call ${provider.toUpperCase()} API`)
  } else {
    console.log(`[AI MOCK] ${fn} → no provider configured, using mock response`)
  }
}

// ─── Post Content Generator ───────────────────────────────────────────────────
export async function generatePostContent(
  state: PostWizardState,
  provider: AIProviderID | null = null
): Promise<GeneratedPostContent> {
  logProvider("generatePostContent", provider)
  console.log("[AI MOCK] generatePostContent called with:", {
    platform: state.platform,
    postType: state.postType,
    topic: state.aiInput.topic,
    tone: state.aiInput.tone,
    useBrandVoice: state.aiInput.useBrandVoice,
    additionalContext: state.aiInput.additionalContext,
  })

  await delay(1500) // simulate AI thinking time

  const toneMap: Record<ContentTone, string> = {
    professional: "industry-leading expertise and strategic insight",
    casual: "everyday language and relatable experiences",
    humorous: "wit and playful observations that make people smile",
    educational: "clear explanations and actionable takeaways",
    inspirational: "motivating stories and empowering messages",
    promotional: "compelling value propositions and clear calls-to-action",
    bold: "confident statements and disruptive ideas",
    empathetic: "understanding, warmth, and emotional connection",
  }

  const toneDescription = toneMap[state.aiInput.tone] || "authentic storytelling"
  const topic = state.aiInput.topic || "our latest update"

  // Platform-specific outputs
  if (state.platform === "x" && state.postType === "thread") {
    const threadPosts = [
      `🧵 Let's talk about ${topic}. This changed everything for me — and it might for you too.`,
      `First, the context you need to understand this properly. Most people get this wrong from the start...`,
      `Here's the core insight: ${topic} isn't just a tactic. It's a mindset shift that compounds over time.`,
      `The 3 things that actually move the needle:\n\n1. Consistency over perfection\n2. Audience-first thinking\n3. Clear calls-to-action`,
      `The result? After applying these principles, engagement went up 3x in 30 days. Here's the exact breakdown 👇`,
      `Bottom line: Start with ${topic} today. Not next week. Not when you feel ready. NOW.\n\nRT if this helped. Save for when you need it. 🔖`,
    ]

    const result: GeneratedPostContent = {
      caption: threadPosts[0],
      flyers: [
        { id: "f1", text: topic.toUpperCase(), subtext: `A thread on ${toneDescription} — tap to read all posts` },
      ] satisfies FlyerContent[],
      imageSuggestion: `Upload an image that represents ${topic} — could be a workspace, product, or concept visualization`,
      hashtags: ["#BuildInPublic", "#ContentStrategy", "#ThreadAlert", "#MustRead"],
      threadPosts,
    }

    console.log("[AI MOCK] Generated thread content:", result)
    return result
  }

  if (state.platform === "instagram" && state.postType === "carousel") {
    const carouselSlides = [
      {
        text: `${topic.toUpperCase()}`,
        subtext: "Swipe to learn more →",
      },
      {
        text: "The Problem",
        subtext: `Most people approach ${topic} the wrong way. Here's what they miss...`,
      },
      {
        text: "The Solution",
        subtext: `By focusing on ${toneDescription}, you unlock a completely different result.`,
      },
      {
        text: "Step 1",
        subtext: "Define your goal clearly before taking any action",
      },
      {
        text: "Step 2",
        subtext: "Build systems that work for you, not against you",
      },
      {
        text: "The Result",
        subtext: `Consistent action + ${toneDescription} = real, lasting impact.`,
      },
      {
        text: "Save This Post",
        subtext: "Follow for more insights like this every week 🔖",
      },
    ]

    const result: GeneratedPostContent = {
      caption: `Everything you need to know about ${topic} — in 7 slides. Save this before you scroll past! 🔖\n\n${carouselSlides
        .slice(1, 4)
        .map((s) => `• ${s.subtext}`)
        .join("\n")}\n\n👇 Which slide resonated most?`,
      flyers: [
        { id: "f1", text: topic.toUpperCase(), subtext: `${carouselSlides.length} slides · Save this for later` },
        { id: "f2", text: "SWIPE TO LEARN", subtext: toneDescription },
        { id: "f3", text: "TAKE ACTION NOW", subtext: `Start your ${topic} journey today` },
      ] satisfies FlyerContent[],
      imageSuggestion: `Upload a bold, high-contrast image that represents ${topic}. Clean background preferred.`,
      hashtags: [
        "#ContentCreator",
        "#InstagramTips",
        "#SaveThis",
        `#${topic.replace(/\s+/g, "")}`,
      ],
      carouselSlides,
    }

    console.log("[AI MOCK] Generated carousel content:", result)
    return result
  }

  // ── X / single tweet ──────────────────────────────────────────────────────
  if (state.platform === "x") {
    const result: GeneratedPostContent = {
      caption: `${topic} just changed the game.\n\nHere's what nobody's saying about it — ${toneDescription} is the real unlock. Most people skip this step entirely.\n\nYour move. 👇 #${topic.replace(/\s+/g, "")} #BuildInPublic`,
      flyers: [
        { id: "f1", text: topic.toUpperCase(), subtext: `The unlock most people miss` },
      ] satisfies FlyerContent[],
      imageSuggestion: `Upload a bold, high-contrast image related to "${topic}" — it will appear alongside your tweet`,
      hashtags: [`#${topic.replace(/\s+/g, "")}`, "#BuildInPublic"],
    }
    console.log("[AI MOCK] Generated X single tweet:", result)
    return result
  }

  // ── Instagram / story ─────────────────────────────────────────────────────
  if (state.platform === "instagram" && state.postType === "story") {
    const overlay = topic.toUpperCase().slice(0, 24)
    const result: GeneratedPostContent = {
      caption: overlay,
      flyers: [
        { id: "f1", text: overlay },
      ] satisfies FlyerContent[],
      imageSuggestion: `Upload a striking 9:16 vertical image — the story will overlay this with your text`,
      hashtags: [],
    }
    console.log("[AI MOCK] Generated Instagram story:", result)
    return result
  }

  // ── Instagram / single feed post ──────────────────────────────────────────
  if (state.platform === "instagram") {
    const result: GeneratedPostContent = {
      caption: `✨ ${topic}\n\nHere's something most people in this space never say out loud...\n\nWhen you genuinely apply ${toneDescription}, the results compound in ways you'd never expect. We've been doing this for a while now, and the biggest lesson? Consistency beats perfection — every single time.\n\nHere's what that looks like in practice:\n\n→ Show up even when you don't feel ready\n→ Prioritise your audience over your ego\n→ Let your results speak louder than your claims\n\nSave this if it resonated. And if you've been through something similar — drop your story below 👇`,
      flyers: [
        { id: "f1", text: topic.toUpperCase(), subtext: `Here's what ${toneDescription} really looks like` },
        { id: "f2", text: "THE SECRET?", subtext: `Consistency over perfection — every time` },
      ] satisfies FlyerContent[],
      imageSuggestion: `Upload a warm, lifestyle image connecting emotionally to "${topic}" — bright natural light, authentic feel`,
      hashtags: [
        `#${topic.replace(/\s+/g, "")}`,
        "#ContentCreator",
        "#InstagramMarketing",
        "#GrowthMindset",
        "#Entrepreneur",
        "#DigitalMarketing",
        "#Motivation",
        "#BusinessTips",
      ],
    }
    console.log("[AI MOCK] Generated Instagram single post:", result)
    return result
  }

  // ── LinkedIn / document carousel ──────────────────────────────────────────
  if (state.platform === "linkedin" && state.postType === "carousel") {
    const linkedInSlides = [
      { text: topic.toUpperCase(), subtext: "A LinkedIn document worth saving →" },
      { text: "The Problem", subtext: `Most professionals approach ${topic} the wrong way — missing what actually drives results.` },
      { text: "Root Cause", subtext: `It comes down to ${toneDescription}. When this is absent, even the best strategies fall flat.` },
      { text: "The Framework", subtext: "3 principles:\n1. Clarity of intent\n2. Consistency of action\n3. Courage to iterate" },
      { text: "Real Results", subtext: `Professionals applying ${toneDescription} to ${topic} consistently outperform peers by 3–5x.` },
      { text: "Action Step", subtext: `This week: find one area where ${topic} can shift your results. Start there.` },
      { text: "Follow For More", subtext: `More frameworks like this every week. Save it. Share it.` },
    ]
    const result: GeneratedPostContent = {
      caption: `I put together a 7-slide breakdown on ${topic}.\n\nThis document captures everything I wish I knew earlier about ${toneDescription}.\n\nSave it. Share it. Come back to it.\n\n#${topic.replace(/\s+/g, "")} #LinkedInLearning #Professional`,
      flyers: [
        { id: "f1", text: topic.toUpperCase(), subtext: "Swipe through the document →" },
      ] satisfies FlyerContent[],
      imageSuggestion: `Upload a clean cover image — a professional headshot or branded graphic works well as the document cover`,
      hashtags: [`#${topic.replace(/\s+/g, "")}`, "#LinkedInLearning", "#Professional"],
      carouselSlides: linkedInSlides,
    }
    console.log("[AI MOCK] Generated LinkedIn document carousel:", result)
    return result
  }

  // ── LinkedIn / text or image post ─────────────────────────────────────────
  if (state.platform === "linkedin") {
    const result: GeneratedPostContent = {
      caption: `I've been thinking a lot about ${topic} lately.\n\nHere's the honest truth most people in this space won't say:\n\n${toneDescription} is the single biggest factor separating those who get results from those who don't.\n\nI learned this the hard way. Three years ago I was doing everything "right" — following playbooks, hitting metrics, checking boxes. Something felt off.\n\nIt wasn't until I doubled down on ${toneDescription} that everything changed:\n\n→ My output became more focused\n→ My audience became more engaged\n→ My results started compounding\n\nThe formula isn't complicated. It requires something most people resist: showing up with intention, not just effort.\n\nIf you're working through ${topic}, I'd love to hear where you're at. Drop a comment — let's figure it out together.\n\n#${topic.replace(/\s+/g, "")} #LinkedInGrowth #ProfessionalDevelopment #Leadership`,
      flyers: [
        { id: "f1", text: topic.toUpperCase(), subtext: `The honest truth about ${toneDescription}` },
        { id: "f2", text: "THE REAL LESSON", subtext: `What 3 years of ${topic} actually taught me` },
      ] satisfies FlyerContent[],
      imageSuggestion: `Upload a professional, clean image — a branded graphic, workspace photo, or infographic that supports the ${topic} narrative`,
      hashtags: [
        `#${topic.replace(/\s+/g, "")}`,
        "#LinkedInGrowth",
        "#ProfessionalDevelopment",
        "#Leadership",
        "#CareerAdvice",
      ],
    }
    console.log("[AI MOCK] Generated LinkedIn post:", result)
    return result
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  const result: GeneratedPostContent = {
    caption: `${topic} — it's not what you think.\n\nThe truth is beautifully simple when you understand ${toneDescription}.\n\nWhat's your take? Drop it below 👇`,
    flyers: [
      { id: "f1", text: topic.toUpperCase(), subtext: `Here's what ${toneDescription} really looks like` },
      { id: "f2", text: "THE REAL TRUTH", subtext: `Most people overcomplicate ${topic}` },
    ] satisfies FlyerContent[],
    imageSuggestion: `Upload an image that captures the essence of "${topic}"`,
    hashtags: [`#${topic.replace(/\s+/g, "")}`, "#ContentStrategy", "#SocialMedia"],
  }

  console.log("[AI MOCK] Generated post content:", result)
  return result
}

// ─── Image Suggestion Updater ─────────────────────────────────────────────────
export async function generateImageSuggestion(
  caption: string,
  flyerStyle: string,
  provider: AIProviderID | null = null
): Promise<string> {
  logProvider("generateImageSuggestion", provider)
  console.log("[AI MOCK] generateImageSuggestion called:", { caption, flyerStyle })
  await delay(800)

  const suggestions = [
    "Upload a high-energy action shot of a person confidently working at their desk",
    "Upload an image of modern tech gadgets arranged on a clean flat lay",
    "Upload a warm, natural-light portrait of a person smiling directly at the camera",
    "Upload a minimalist product shot on a white or neutral background",
    "Upload a dynamic outdoor lifestyle image with natural textures in the background",
    "Upload an image of hands collaborating over a notebook or laptop",
    "Upload a bold, colorful abstract image that complements the text overlay",
    "Upload a behind-the-scenes candid shot showing a real workspace or process",
  ]

  const suggestion = suggestions[Math.floor(Math.random() * suggestions.length)]
  console.log("[AI MOCK] Image suggestion:", suggestion)
  return suggestion
}

// ─── Reply Generator ──────────────────────────────────────────────────────────
export async function generateReplies(
  input: ReplyComposerInput,
  provider: AIProviderID | null = null
): Promise<GeneratedReply[]> {
  logProvider("generateReplies", provider)
  console.log("[AI MOCK] generateReplies called with:", input)
  await delay(1200)

  const replies: GeneratedReply[] = [
    {
      id: "reply-1",
      text: `This is such a valid point. What's worked for us is leaning into authenticity rather than chasing trends. The audience always knows when you're being real.`,
      tone: "professional",
      characterCount: 156,
    },
    {
      id: "reply-2",
      text: `Completely agree 👊 The brands winning right now aren't the loudest — they're the most consistent. Keep going!`,
      tone: "casual",
      characterCount: 112,
    },
    {
      id: "reply-3",
      text: `Great perspective. I'd add that the data usually points to a gap between what brands think their audience wants vs. what they actually engage with. Worth A/B testing your hypothesis.`,
      tone: "educational",
      characterCount: 182,
    },
  ]

  console.log("[AI MOCK] Generated replies:", replies)
  return replies
}

// ─── Engagement Generator ────────────────────────────────────────────────────
export async function generateEngagements(
  input: EngageComposerInput,
  provider: AIProviderID | null = null
): Promise<GeneratedEngagement[]> {
  logProvider("generateEngagements", provider)
  console.log("[AI MOCK] generateEngagements called with:", input)
  await delay(1200)

  const engagements: GeneratedEngagement[] = [
    {
      id: "engage-1",
      text: `The shift from broadcast to conversation is the most underrated growth lever right now. What's stopping most brands is ego — they'd rather talk than listen.`,
      type: "insight",
      characterCount: 174,
    },
    {
      id: "engage-2",
      text: `Curious — what's the one thing your audience consistently asks for that you haven't built yet?`,
      type: "question",
      characterCount: 97,
    },
    {
      id: "engage-3",
      text: `Hot take: The brands with the smallest budgets but the clearest voice will outperform the big players in the next 18 months. The playing field has genuinely shifted.`,
      type: "conversation-starter",
      characterCount: 168,
    },
    {
      id: "engage-4",
      text: `Love the direction you're taking with this. The intentionality behind every post is immediately visible — it makes a difference.`,
      type: "comment",
      characterCount: 128,
    },
  ]

  console.log("[AI MOCK] Generated engagements:", engagements)
  return engagements
}

// ─── Content Ideas Generator ─────────────────────────────────────────────────
export async function generateContentIdeas(
  input: ContentIdeasInput,
  provider: AIProviderID | null = null
): Promise<ContentIdea[]> {
  logProvider("generateContentIdeas", provider)
  console.log("[AI MOCK] generateContentIdeas called with:", input)
  await delay(2000)

  const ideaTemplates: Record<
    ContentIdeaType,
    (topic: string, index: number) => ContentIdea
  > = {
    skit: (topic, i) => ({
      id: `gen-skit-${i}`,
      type: "skit" as ContentIdeaType,
      title: `The ${topic} Struggle Is Real`,
      description: `A short, relatable skit dramatizing a common frustration or funny moment around ${topic}. Ends with a clever twist that ties back to your brand.`,
      script: `Character A walks in confidently.\nCharacter A: "I've finally figured out ${topic}!"\nCharacter B: "Amazing! How?"\nCharacter A proceeds to explain the most overcomplicated method imaginable.\nCharacter B stares blankly.\nCut to: The simple, obvious solution.`,
      visualDirection: "Two-person setup, office or casual home environment, comedic timing is everything",
      suggestedCaption: `We've all been Character A at some point 😅 #Relatable`,
      platforms: input.platforms,
      estimatedDuration: "20–45 seconds",
      callToAction: "Tag someone who does this",
      props: ["Two people", "A prop that represents the topic"],
    }),
    comedy: (topic, i) => ({
      id: `gen-comedy-${i}`,
      type: "comedy" as ContentIdeaType,
      title: `When ${topic} Goes Wrong`,
      description: `A comedy sketch or talking-head video highlighting the absurdity of common mistakes people make around ${topic}. Light-hearted and shareable.`,
      visualDirection: "Direct-to-camera, exaggerated reactions, quick cuts",
      suggestedCaption: `Nobody warned me about this part of ${topic} 😂`,
      platforms: input.platforms,
      estimatedDuration: "15–30 seconds",
      callToAction: "Share if you've been here",
    }),
    "non-verbal": (topic, i) => ({
      id: `gen-nonverbal-${i}`,
      type: "non-verbal" as ContentIdeaType,
      title: `${topic} in Silence`,
      description: `A visually compelling, no-dialogue video telling the story of ${topic} through visuals, text overlays, and music alone. Ideal for reels/shorts.`,
      visualDirection:
        "Cinematic shots, satisfying transitions, on-screen text with key stats or insights. Music: upbeat instrumental or trending audio",
      suggestedCaption: `Sometimes the work speaks for itself 🎬 #${topic.replace(/\s+/g, "")}`,
      platforms: input.platforms,
      estimatedDuration: "15–30 seconds",
      callToAction: "Save for inspiration",
    }),
    verbal: (topic, i) => ({
      id: `gen-verbal-${i}`,
      type: "verbal" as ContentIdeaType,
      title: `The Truth About ${topic}`,
      description: `A direct-to-camera talking-head video sharing a genuine, maybe unpopular truth about ${topic}. No fluff, no corporate speak — just honest perspective.`,
      script: `Hook (0-3s): "Here's what nobody tells you about ${topic}."\nBody: 3 specific points backed by experience or data.\nClose: "If you're navigating ${topic} right now — this is what I wish someone had told me earlier."`,
      visualDirection: "Clean background, good lighting, confident eye contact with camera",
      suggestedCaption: `I wish I knew this earlier about ${topic} 💡`,
      platforms: input.platforms,
      estimatedDuration: "45–90 seconds",
      callToAction: "Reply with your experience",
    }),
    educational: (topic, i) => ({
      id: `gen-educational-${i}`,
      type: "educational" as ContentIdeaType,
      title: `${topic}: A Beginner's Guide`,
      description: `A structured educational post breaking down ${topic} into digestible steps for an audience who is new to it or wants to deepen their understanding.`,
      visualDirection:
        "Carousel or step-by-step video. Clean typography, numbered steps, visual icons",
      suggestedCaption: `Everything you need to know about ${topic} — in one post. Save this 🔖`,
      platforms: input.platforms,
      estimatedDuration: "60 seconds or 5–8 slides",
      callToAction: "Share with someone who needs this",
    }),
    promotional: (topic, i) => ({
      id: `gen-promotional-${i}`,
      type: "promotional" as ContentIdeaType,
      title: `Why ${topic} Matters for Your Business`,
      description: `A promotional piece that highlights your brand's unique take on ${topic} and leads naturally into a call-to-action for your product or service.`,
      visualDirection: "Brand colors prominent, professional polish, clear product/service showcase",
      suggestedCaption: `This is exactly why we built what we built around ${topic}. Swipe to see →`,
      platforms: input.platforms,
      estimatedDuration: "30–60 seconds",
      callToAction: "Link in bio / Book a call",
    }),
    "behind-the-scenes": (topic, i) => ({
      id: `gen-bts-${i}`,
      type: "behind-the-scenes" as ContentIdeaType,
      title: `The Making of: ${topic}`,
      description: `Raw, authentic content showing your process, team, or workspace related to ${topic}. Audiences love seeing the human side of a brand.`,
      visualDirection: "Handheld, raw footage, natural environment. Show the mess, the process, the real",
      suggestedCaption: `Nobody shows you this part of ${topic}. We are 👀`,
      platforms: input.platforms,
      estimatedDuration: "30–60 seconds",
      callToAction: "Tell us: want to see more of this?",
    }),
    testimonial: (topic, i) => ({
      id: `gen-testimonial-${i}`,
      type: "testimonial" as ContentIdeaType,
      title: `Real Story: How ${topic} Changed Everything`,
      description: `Feature a customer, client, or community member sharing their genuine experience with ${topic} and how your brand played a role in their journey.`,
      visualDirection: "Warm interview-style or screen-recorded testimonial with animated text overlays",
      suggestedCaption: `This story about ${topic} gave us chills. Real people, real results 💛`,
      platforms: input.platforms,
      estimatedDuration: "45–90 seconds",
      callToAction: "Share your story in the comments",
    }),
    trending: (topic, i) => ({
      id: `gen-trending-${i}`,
      type: "trending" as ContentIdeaType,
      title: `Our Take: The ${topic} Conversation`,
      description: `Jump into a trending conversation around ${topic} with your brand's unique perspective. Be timely, relevant, and distinctly you.`,
      visualDirection: "Fast-paced edit matching current trend format. On-trend transitions, audio, text",
      suggestedCaption: `Had to say something about this ${topic} discussion going around 🗣️`,
      platforms: input.platforms,
      estimatedDuration: "15–30 seconds",
      callToAction: "What's your take?",
    }),
    storytelling: (topic, i) => ({
      id: `gen-story-${i}`,
      type: "storytelling" as ContentIdeaType,
      title: `The ${topic} Journey`,
      description: `A narrative-driven piece telling the story of how ${topic} unfolded — the challenge, the turning point, and the lesson. Deeply personal and shareable.`,
      script: `Opening: Set the scene — what was the situation before?\nConflict: What challenge around ${topic} arose?\nTurning point: The moment everything shifted.\nResolution: What changed and what was learned?`,
      visualDirection: "Documentary-style, mix of b-roll and talking-head, emotional music",
      suggestedCaption: `The ${topic} story I've been sitting on. It's time to share it 🎙️`,
      platforms: input.platforms,
      estimatedDuration: "60–120 seconds",
      callToAction: "Reply with your story",
    }),
  }

  const topic = input.topic || "your niche"
  const ideas: ContentIdea[] = []

  input.contentTypes.forEach((type, idx) => {
    const generator = ideaTemplates[type]
    if (generator) {
      ideas.push(generator(topic, idx))
    }
  })

  // If "all" types selected, generate 1 of each
  if (input.contentTypes.length === 0) {
    const allTypes = Object.keys(ideaTemplates) as ContentIdeaType[]
    allTypes.forEach((type, idx) => {
      ideas.push(ideaTemplates[type](topic, idx))
    })
  }

  // Enrich each idea with videoPrompt and sceneBreakdown
  const enrichedIdeas = ideas.map((idea) => ({
    ...idea,
    videoPrompt: `Cinematic close-up of hands typing on a laptop in a modern coworking space, warm golden-hour light streaming through floor-to-ceiling windows. Quick cuts between team collaboration moments — sticky notes, whiteboard sketches, confident smiles. Upbeat lo-fi soundtrack. Text overlay: '${topic}'. Aspect ratio 9:16.`,
    sceneBreakdown:
      idea.type === "skit" || idea.type === "storytelling" || idea.type === "comedy"
        ? [
            { scene: "Opening", action: "Creator walks into frame confidently, sits at desk", duration: "0–3s" },
            { scene: "Setup", action: `Shows the 'wrong way' to approach ${topic} with exaggerated frustration`, duration: "3–12s" },
            { scene: "Twist", action: "Simple solution revealed — reaction shot of relief/surprise", duration: "12–20s" },
            { scene: "CTA", action: "Look directly at camera: 'Save this if you've been here'", duration: "20–25s" },
          ]
        : undefined,
  }))

  console.log("[AI MOCK] Generated content ideas:", enrichedIdeas)
  return enrichedIdeas
}

// ─── Marketing Strategy Generator ───────────────────────────────────────────
export async function generateMarketingStrategy(
  input: MarketingStrategyInput,
  provider: AIProviderID | null = null
): Promise<MarketingStrategy> {
  logProvider("generateMarketingStrategy", provider)
  console.log("[AI MOCK] generateMarketingStrategy called with:", input)
  await delay(2500)

  const goalLabels: Record<string, string> = {
    "grow-followers": "audience growth",
    "increase-engagement": "engagement",
    "drive-traffic": "website traffic",
    "product-launch": "product launch",
    "brand-awareness": "brand awareness",
    "lead-generation": "lead generation",
  }
  const goalFocus = input.goals.map((g) => goalLabels[g]).join(", ") || "brand growth"
  const platformList = input.platforms.join(", ") || "social media"

  const strategy: MarketingStrategy = {
    id: `strategy-${Date.now()}`,
    overview: `Based on your brand profile, stage, and goals, here's a targeted growth strategy focused on ${goalFocus} across ${platformList}. The approach prioritises consistency and authentic storytelling over paid amplification — building an audience that compounds organically over time. Key leverage points include establishing clear content pillars, posting at optimal frequencies, and converting passive followers into active community members through intentional engagement loops.`,

    contentPillars: [
      {
        name: "Authority & Expertise",
        description:
          "Demonstrate deep knowledge in your niche. Share insights, data, and perspectives that only someone inside the industry would know.",
        exampleFormats: ["How-to carousels", "Educational threads", "Myth-busting posts", "Industry stats breakdowns"],
        postingFrequency: "2–3× per week",
      },
      {
        name: "Behind the Brand",
        description:
          "Humanise your brand with authentic behind-the-scenes content. Show the process, the team, and the real story behind what you build.",
        exampleFormats: ["BTS videos", "Day-in-the-life reels", "Team spotlights", "Process reveals"],
        postingFrequency: "1–2× per week",
      },
      {
        name: "Social Proof & Results",
        description:
          "Build trust through testimonials, case studies, and before/after transformations. Let your customers tell your story.",
        exampleFormats: ["Client testimonials", "Case study carousels", "Results screenshots", "Community highlights"],
        postingFrequency: "1× per week",
      },
      {
        name: "Conversation & Community",
        description:
          "Drive two-way interaction with opinion posts, questions, and trending discussions that invite your audience to participate.",
        exampleFormats: ["Poll posts", "Hot takes", "Question prompts", "Trend commentary"],
        postingFrequency: "2× per week",
      },
      {
        name: "Value Offers",
        description:
          "Strategic promotional content that ties directly to your product or service, framed around value rather than selling.",
        exampleFormats: ["Product demos", "Feature spotlights", "Free resource drops", "Limited offers"],
        postingFrequency: "1× per week",
      },
    ],

    growthTactics: [
      {
        title: "Consistency Before Volume",
        description:
          "Post on a fixed schedule your audience can predict. Algorithms reward consistency. Start with 3–4 posts/week and scale only after your system is stable.",
        effort: "medium",
        impact: "high",
      },
      {
        title: "First-Hour Engagement Window",
        description:
          "Be active in the comments within the first 60 minutes of each post. Algorithmic reach is disproportionately driven by early engagement signals.",
        effort: "low",
        impact: "high",
      },
      {
        title: "Strategic Collaboration",
        description:
          "Partner with creators or brands in adjacent niches for co-created content, shoutouts, or joint live sessions to tap into established audiences.",
        effort: "medium",
        impact: "high",
      },
      {
        title: "Content Repurposing System",
        description:
          "Turn one long-form piece (blog, video) into 5–8 shorter social assets. A LinkedIn article becomes a carousel, becomes a thread, becomes 3 short clips.",
        effort: "medium",
        impact: "medium",
      },
      {
        title: "Hashtag & SEO Optimisation",
        description:
          "Use a mix of niche (10k–100k posts), mid-tier (100k–1M), and broad tags. Research keywords your audience actually searches for within the platform.",
        effort: "low",
        impact: "medium",
      },
      {
        title: "Community Engagement Loop",
        description:
          "Spend 20 minutes daily engaging genuinely with content from accounts in your niche. Leave value-adding comments, not generic reactions.",
        effort: "low",
        impact: "high",
      },
      ...(input.platforms.includes("instagram")
        ? [
            {
              title: "Reels-First Strategy (Instagram)",
              description:
                "Reels get 2–3× more reach than static posts. Commit to at least 3 Reels per week. Use trending audio within 48 hours of it trending for maximum boost.",
              platform: "instagram" as const,
              effort: "high" as const,
              impact: "high" as const,
            },
          ]
        : []),
      ...(input.platforms.includes("linkedin")
        ? [
            {
              title: "LinkedIn Creator Mode + Newsletter",
              description:
                "Enable Creator Mode to grow followers (not just connections). Start a LinkedIn Newsletter — subscribers get notified every issue, bypassing the algorithm.",
              platform: "linkedin" as const,
              effort: "medium" as const,
              impact: "high" as const,
            },
          ]
        : []),
      ...(input.platforms.includes("x")
        ? [
            {
              title: "X Thread Strategy",
              description:
                "Long-form threads (6–10 posts) consistently outperform single tweets for impressions and follows. Publish 2 threads/week with a strong hook post.",
              platform: "x" as const,
              effort: "medium" as const,
              impact: "high" as const,
            },
          ]
        : []),
    ],

    toolRecommendations: [
      {
        name: "PostFlow (You're Here)",
        category: "Content Scheduling & AI",
        description:
          "Use PostFlow's AI post generator + brand voice to batch-create a week's content in one session. Schedule across platforms and track from one dashboard.",
        pricing: "Your current plan",
      },
      {
        name: "Canva",
        category: "Visual Design",
        description:
          "Create on-brand graphics, carousels, and story assets using the Brand Kit feature to keep colours, fonts, and logos consistent without a designer.",
        pricing: "Free / Pro from $12.99/mo",
      },
      {
        name: "Notion",
        category: "Content Planning",
        description:
          "Build a content calendar and idea vault in Notion. Use linked databases to track post status, platform, and performance notes all in one place.",
        pricing: "Free / Plus from $8/mo",
      },
      {
        name: "Metricool",
        category: "Analytics & Reporting",
        description:
          "Cross-platform analytics in one view. Track reach, engagement rate, follower growth, and best posting times to optimise your schedule with real data.",
        pricing: "Free / Smart from $18/mo",
      },
      {
        name: "CapCut",
        category: "Video Editing",
        description:
          "Fast, mobile-first video editor purpose-built for social content. Auto-captions, trending templates, and AI tools make short-form video production fast.",
        pricing: "Free / Pro from $7.99/mo",
      },
      {
        name: "Beehiiv / ConvertKit",
        category: "Email & Newsletter",
        description:
          "Capture your social audience into an owned channel. A newsletter means you're not dependent on platform algorithms for reach. Start before you think you need it.",
        pricing: "Free tier available / from $9/mo",
      },
    ],

    kpis: [
      {
        metric: "Follower Growth Rate",
        target: input.businessStage === "startup" ? "10–15% MoM" : "5–8% MoM",
        timeframe: "Monthly",
        howToMeasure: "((New followers – Lost followers) / Start followers) × 100",
      },
      {
        metric: "Engagement Rate",
        target: input.platforms.includes("instagram") ? "3–6%" : "2–4%",
        timeframe: "Per post average",
        howToMeasure: "(Likes + Comments + Saves + Shares) / Reach × 100",
      },
      {
        metric: "Reach per Post",
        target: "Growing 10%+ week-over-week",
        timeframe: "Weekly average",
        howToMeasure: "Track in native analytics or Metricool dashboard",
      },
      {
        metric: "Link Click-Through Rate",
        target: "1–3% of reach",
        timeframe: "Monthly",
        howToMeasure: "Bio link clicks / Total profile visits × 100",
      },
      {
        metric: "Content Save Rate",
        target: "3–7% of impressions",
        timeframe: "Per post average",
        howToMeasure: "Saves / Impressions × 100 — a leading indicator of value",
      },
      {
        metric: "Response Rate",
        target: "100% of comments replied to",
        timeframe: "Within 24h of posting",
        howToMeasure: "Manual tracking or social inbox tools",
      },
    ],

    roadmap: [
      {
        phase: "Phase 1 — Foundation",
        timeframe: input.timeline === "1-month" ? "Week 1–2" : "Month 1",
        focus: "Set up systems, define voice, establish baseline",
        actions: [
          "Complete brand voice profile in PostFlow",
          "Audit existing content and delete anything off-brand",
          "Optimise all platform bios with clear value proposition + CTA",
          "Set up content calendar with 4 weeks of planned content",
          "Establish posting schedule and commit to it",
        ],
      },
      {
        phase: "Phase 2 — Content Engine",
        timeframe: input.timeline === "1-month" ? "Week 3–4" : "Month 2–3",
        focus: "Build momentum with consistent, high-quality output",
        actions: [
          "Launch all 5 content pillars with at least 2 posts each",
          "Test 3 different formats per platform and track performance",
          "Start engaging in 5 niche communities daily",
          "Identify top-performing content types and double down",
          "Set up analytics tracking for all key KPIs",
        ],
      },
      {
        phase: "Phase 3 — Growth",
        timeframe: input.timeline === "1-month" ? "Ongoing" : "Month 3–6",
        focus: "Amplify what's working, experiment and scale",
        actions: [
          "Launch first collaboration with a complementary creator or brand",
          "Repurpose top-performing posts into new formats",
          "Introduce lead magnet or newsletter to capture audience",
          "Run first paid promotion on best-performing organic content",
          "Review KPIs monthly and adjust strategy based on data",
        ],
      },
    ],

    generatedAt: new Date(),
  }

  console.log("[AI MOCK] Generated marketing strategy:", strategy)
  return strategy
}

// ─── Post Ideas Generator ─────────────────────────────────────────────────────
export async function generatePostIdeas(
  input: PostIdeasInput,
  provider: AIProviderID | null = null
): Promise<PostIdea[]> {
  logProvider("generatePostIdeas", provider)
  console.log("[AI MOCK] generatePostIdeas called with:", input)
  await delay(1800)

  const topic = input.topic || "your brand"
  const ideas: PostIdea[] = []

  const captionTemplates = [
    {
      title: `The ${topic} Playbook`,
      caption: `Stop guessing. Start growing. Here's the exact approach we use for ${topic} that's helped us go from 0 to 10k followers in 90 days. The secret? Consistency over perfection — every single time. 💡`,
      postType: "single" as const,
      tone: "educational" as const,
      imagePrompt: `A clean, flat-lay desk setup with a notebook, laptop, and coffee. The notebook reads '${topic}'. Warm, natural lighting. Minimal aesthetic.`,
    },
    {
      title: `Hot Take: ${topic}`,
      caption: `Unpopular opinion: most people are approaching ${topic} completely backwards. The brands winning right now aren't the ones with the biggest budgets — they're the ones with the clearest voice. What's yours? 🔥`,
      postType: "text" as const,
      tone: "bold" as const,
      imagePrompt: `Bold typography graphic with the text 'Hot Take' in a striking font on a dark background. Accent colors pop.`,
    },
    {
      title: `${topic} in 60 Seconds`,
      caption: `You asked, we answered. Everything you need to know about ${topic} — no fluff, no filler. Just the good stuff. Save this for later 🔖`,
      postType: "carousel" as const,
      tone: input.tone,
      imagePrompt: `A series of clean slide mockups showing steps or tips. Branded color palette, readable typography, icons for visual interest.`,
    },
    {
      title: `The ${topic} Mistake Everyone Makes`,
      caption: `I made this mistake for 2 years before someone pointed it out. If you're serious about ${topic}, don't skip this. Thread below 🧵`,
      postType: "thread" as const,
      tone: "casual" as const,
      imagePrompt: `A person looking thoughtfully at their phone in a bright, modern setting. Expression of realization. Authentic, not staged.`,
    },
    {
      title: `Why ${topic} Changes Everything`,
      caption: `We don't talk about this enough: ${topic} isn't just a strategy. It's a mindset. When you internalize that, everything in your content changes. Here's what that looks like in practice ✨`,
      postType: "single" as const,
      tone: "inspirational" as const,
      imagePrompt: `Sunrise or golden hour shot over a city skyline. Aspirational feel. Silhouette of a person looking forward. Cinematic composition.`,
    },
    {
      title: `${topic}: Before & After`,
      caption: `6 months ago vs. today. Same brand. Same product. Completely different results — all because we changed how we talk about ${topic}. Swipe to see the transformation →`,
      postType: "carousel" as const,
      tone: "promotional" as const,
      imagePrompt: `Split-panel design showing 'before' on the left (muted, grey) and 'after' on the right (vibrant, colorful). Clean layout with clear contrast.`,
    },
  ]

  const selectedCount = Math.min(input.count, captionTemplates.length)

  for (const platform of input.platforms) {
    for (let i = 0; i < selectedCount; i++) {
      const template = captionTemplates[i % captionTemplates.length]
      ideas.push({
        id: `post-idea-${platform}-${i}-${Date.now()}`,
        platform,
        postType: template.postType,
        title: template.title,
        caption: template.caption,
        hashtags: [
          `#${topic.replace(/\s+/g, "")}`,
          "#ContentMarketing",
          "#SocialMedia",
          platform === "instagram" ? "#InstagramTips" : platform === "linkedin" ? "#LinkedInMarketing" : "#TwitterTips",
        ],
        tone: template.tone,
        imagePrompt: template.imagePrompt,
        saved: false,
      })
    }
  }

  console.log("[AI MOCK] Generated post ideas:", ideas)
  return ideas
}

// ─── Video Prompt Generator ───────────────────────────────────────────────────
export async function generateVideoPrompt(
  idea: ContentIdea,
  provider: AIProviderID | null = null
): Promise<string> {
  logProvider("generateVideoPrompt", provider)
  console.log("[AI MOCK] generateVideoPrompt called with:", idea)
  await delay(1000)

  const prompts: Record<string, string> = {
    skit: `Two creators in a modern, bright studio space — one confidently explaining a concept while the other reacts with growing disbelief. Quick comedic cuts highlight the contrast between the 'wrong' and 'right' approach. Handheld camera feel, natural lighting with a warm colour grade. Upbeat lo-fi track underneath. Text overlay: '${idea.title}'. Aspect ratio 9:16, 25 seconds.`,
    comedy: `Fast-paced montage of relatable fail moments — exaggerated facial expressions, quick zoom-ins, satirical on-screen text. Bright, slightly overexposed lighting for a fun energy. Jump cuts every 2–3 seconds. Trending comedic audio in background. Text overlay: '${idea.title}'. Aspect ratio 9:16, 20 seconds.`,
    "non-verbal": `Cinematic time-lapse of a creative workspace coming to life — blank desk transforms into a fully set-up workstation. No dialogue, only satisfying sounds (keyboard clicks, marker on whiteboard). Warm golden-hour light transitions to cool evening tones. Smooth B-roll cuts. Text overlay: '${idea.title}'. Aspect ratio 9:16, 30 seconds.`,
    verbal: `Direct-to-camera talking head in a clean, minimal studio. Confident delivery, intentional pauses, genuine eye contact. Soft bokeh background with subtle brand colour. Lower-thirds text emphasises key points. Professional but approachable grade. Audio-driven pacing. Aspect ratio 9:16, 60 seconds.`,
    educational: `Clean motion graphics and text animations explain the concept step-by-step. Split-screen shows real-world example alongside diagram. Cool blue and white colour palette conveys clarity and trust. Calm, explanatory voiceover. Each step fades in with a satisfying animation. Aspect ratio 9:16, 45 seconds.`,
    promotional: `Smooth product showcase with slow-motion reveal shots, rotating 360° views, and confident lifestyle b-roll. Rich, saturated colour grade. Logo animation at the end. Upbeat, aspirational soundtrack builds to a crescendo at the CTA. Text overlay: 'Now Available'. Aspect ratio 9:16, 30 seconds.`,
    "behind-the-scenes": `Raw, handheld documentary style following a day in the life behind the brand. Authentic moments — morning setup, team discussions, creative problem-solving. Warm, slightly desaturated grade for a real, intimate feel. Minimal music, mostly ambient sound. Subtitle overlays for key quotes. Aspect ratio 9:16, 60 seconds.`,
    testimonial: `Interview-style testimonial with shallow depth-of-field and warm, flattering lighting. Subject speaks directly to camera with genuine emotion. B-roll cutaways show the product or service in use. Subtle lower-third name card. Gentle acoustic background music. Aspect ratio 16:9 or 9:16, 45–90 seconds.`,
    trending: `Fast-paced, trend-aware edit using the currently viral audio or format. Quick cuts matching the beat, meme-style text overlays, exaggerated reactions. High energy, saturated colours, front-facing camera style. Native platform aesthetic — no over-produced look. Aspect ratio 9:16, 15 seconds.`,
    storytelling: `Narrative arc with a clear three-act structure: setup (moody, introspective), conflict (dramatic music swell), resolution (bright, hopeful colour grade). Mix of talking head and cinematic b-roll. Emotional ambient soundtrack evolves with the story. Subtitle overlays emphasise turning-point lines. Aspect ratio 9:16, 90 seconds.`,
  }

  const prompt = prompts[idea.type] ?? `Cinematic close-up of hands typing on a laptop in a modern coworking space, warm golden-hour light streaming through floor-to-ceiling windows. Quick cuts between team collaboration moments — sticky notes, whiteboard sketches, confident smiles. Upbeat lo-fi soundtrack. Text overlay: '${idea.title}'. Aspect ratio 9:16.`

  console.log("[AI MOCK] Generated video prompt:", prompt)
  return prompt
}

// ─── Brand Voice Analyzer ────────────────────────────────────────────────────
export async function analyzeBrandVoice(
  description: string,
  provider: AIProviderID | null = null
): Promise<{
  suggestedTones: string[]
  suggestedMessages: string[]
  styleNotes: string
}> {
  logProvider("analyzeBrandVoice", provider)
  console.log("[AI MOCK] analyzeBrandVoice called with:", description)
  await delay(1000)

  const result = {
    suggestedTones: ["professional", "inspirational", "bold"],
    suggestedMessages: [
      "Quality is non-negotiable — it shows in everything we do",
      "We're building for the long term, not the next viral moment",
      "Your success is the only metric that matters to us",
    ],
    styleNotes:
      "Based on your brand description, a direct and confident voice will resonate best with your audience. Avoid buzzwords. Speak plainly but powerfully.",
  }

  console.log("[AI MOCK] Brand voice analysis:", result)
  return result
}
