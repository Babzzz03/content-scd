import { get, post, patch } from "./client"
import type { ContentIdea, ContentIdeaType, Platform } from "@/lib/types"

interface ApiContentIdea {
  _id: string
  title: string
  format?: string
  platform?: string
  hook?: string
  description?: string
  whyItWorks?: string
  trendingTags?: string[]
  isSaved?: boolean
}

function normalizePlatform(v: string | undefined): Platform {
  const value = (v ?? "").trim().toLowerCase()
  if (value === "x" || value === "twitter") return "x"
  if (value === "linkedin") return "linkedin"
  return "instagram"
}

function normalizeContentIdeaType(v: string | undefined): ContentIdeaType {
  const value = (v ?? "").trim().toLowerCase()
  if (value === "tutorial" || value === "educational") return "educational"
  if (value === "reaction") return "trending"
  if (value === "day-in-the-life") return "storytelling"
  if (value === "bts" || value === "behind the scenes" || value === "behind-the-scenes") return "behind-the-scenes"
  if (
    value === "skit" ||
    value === "comedy" ||
    value === "non-verbal" ||
    value === "verbal" ||
    value === "promotional" ||
    value === "testimonial" ||
    value === "trending" ||
    value === "storytelling"
  ) return value as ContentIdeaType
  return "educational"
}

function mapApiIdea(idea: ApiContentIdea): ContentIdea {
  const platform = normalizePlatform(idea.platform)
  return {
    id: idea._id,
    type: normalizeContentIdeaType(idea.format),
    title: idea.title,
    description: idea.description ?? idea.hook ?? "",
    format: idea.format,
    hook: idea.hook,
    whyItWorks: idea.whyItWorks,
    trendingTags: (idea.trendingTags ?? []).map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)),
    suggestedCaption: idea.hook,
    platforms: [platform],
    estimatedDuration: "30–60 seconds",
    callToAction: "Save for later",
    saved: idea.isSaved ?? false,
  }
}

export const contentIdeasApi = {
  listSaved: async () => {
    const res = await get<{ data: { ideas: ApiContentIdea[] } }>("/ideas?isSaved=true")
    return res.data.ideas.map(mapApiIdea)
  },

  saveIdea: async (idea: ContentIdea) => {
    const res = await post<{ data: { ideas: ApiContentIdea[] } }>("/ideas", {
      ideas: [
        {
          title: idea.title,
          format: idea.format,
          platform: idea.platforms[0] ?? "instagram",
          hook: idea.hook,
          description: idea.description,
          whyItWorks: idea.whyItWorks,
          trendingTags: idea.trendingTags ?? [],
          type: "idea",
          savedPlatform: idea.platforms[0] ?? "instagram",
          isSaved: true,
        },
      ],
    })
    return mapApiIdea(res.data.ideas[0])
  },

  toggleSaved: async (id: string) => {
    const res = await patch<{ data: { idea: ApiContentIdea } }>(`/ideas/${id}/toggle`)
    return mapApiIdea(res.data.idea)
  },
}
