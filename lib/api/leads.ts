import { get, post, patch, del, getAccessToken } from "./client"
import type { Lead, LeadCampaign, LeadStats, LeadStatus } from "@/lib/types"

/** Backend wraps every payload as { success, message, data }. */
interface Envelope<T> {
  success: boolean
  message: string
  data: T
}

export interface ListLeadsParams {
  campaign?: string
  status?: LeadStatus[] | string
  minScore?: number
  hasWebsite?: boolean
  search?: string
  sort?: "score" | "followers" | "recent" | "name"
  page?: number
  limit?: number
}

const buildQuery = (params: Record<string, unknown>) => {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue
    qs.set(key, Array.isArray(value) ? value.join(",") : String(value))
  }
  const str = qs.toString()
  return str ? `?${str}` : ""
}

export const leadsApi = {
  // ── Campaigns ──────────────────────────────────────────────────────────────
  listCampaigns: async () => {
    const res = await get<Envelope<{ campaigns: LeadCampaign[] }>>("/leads/campaigns")
    return res.data.campaigns
  },

  getCampaign: async (id: string) => {
    const res = await get<Envelope<{ campaign: LeadCampaign }>>(`/leads/campaigns/${id}`)
    return res.data.campaign
  },

  createCampaign: async (body: Partial<LeadCampaign>) => {
    const res = await post<Envelope<{ campaign: LeadCampaign }>>("/leads/campaigns", body)
    return res.data.campaign
  },

  updateCampaign: async (id: string, body: Partial<LeadCampaign>) => {
    const res = await patch<Envelope<{ campaign: LeadCampaign }>>(`/leads/campaigns/${id}`, body)
    return res.data.campaign
  },

  deleteCampaign: (id: string) => del<Envelope<unknown>>(`/leads/campaigns/${id}`),

  startDiscovery: async (id: string) => {
    const res = await post<Envelope<{ campaign: LeadCampaign }>>(`/leads/campaigns/${id}/discover`)
    return res
  },

  pauseCampaign:  (id: string) => post<Envelope<{ campaign: LeadCampaign }>>(`/leads/campaigns/${id}/pause`),
  resumeCampaign: (id: string) => post<Envelope<{ campaign: LeadCampaign }>>(`/leads/campaigns/${id}/resume`),
  syncReplies:    (id: string) => post<Envelope<unknown>>(`/leads/campaigns/${id}/sync-replies`),

  // ── Leads ──────────────────────────────────────────────────────────────────
  listLeads: async (params: ListLeadsParams = {}) => {
    const res = await get<Envelope<{ leads: Lead[]; total: number; page: number; pages: number }>>(
      `/leads${buildQuery(params as Record<string, unknown>)}`
    )
    return res.data
  },

  getStats: async (campaign?: string) => {
    const res = await get<Envelope<LeadStats>>(`/leads/stats${buildQuery({ campaign })}`)
    return res.data
  },

  updateLead: async (id: string, body: Partial<Pick<Lead, "draftMessage" | "approvedMessage" | "status">>) => {
    const res = await patch<Envelope<{ lead: Lead }>>(`/leads/${id}`, body)
    return res.data.lead
  },

  approve: async (id: string, message?: string) => {
    const res = await post<Envelope<{ lead: Lead }>>(`/leads/${id}/approve`, { message })
    return res.data.lead
  },

  skip: async (id: string, reason?: string) => {
    const res = await post<Envelope<{ lead: Lead }>>(`/leads/${id}/skip`, { reason })
    return res.data.lead
  },

  redraft: async (id: string) => {
    const res = await post<Envelope<{ lead: Lead }>>(`/leads/${id}/draft`)
    return res.data.lead
  },

  /** Send immediately. The daily cap still applies unless force is set. */
  sendNow: async (id: string, opts: { message?: string; force?: boolean } = {}) => {
    const res = await post<Envelope<{ lead: Lead; result: { sent: boolean; reason?: string } }>>(
      `/leads/${id}/send`,
      opts
    )
    return res
  },

  bulk: async (ids: string[], action: "approve" | "skip", reason?: string) => {
    const res = await post<Envelope<{ changed: number; blocked: number }>>("/leads/bulk", { ids, action, reason })
    return res
  },

  /**
   * CSV export. Goes through raw fetch rather than the JSON client because the
   * response is a file, not an envelope.
   */
  exportCsvUrl: (params: { campaign?: string; status?: string } = {}) => {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
    return `${base}/leads/export${buildQuery(params as Record<string, unknown>)}`
  },

  downloadCsv: async (params: { campaign?: string; status?: string } = {}) => {
    const res = await fetch(leadsApi.exportCsvUrl(params), {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    })
    if (!res.ok) throw new Error("Export failed")
    return res.blob()
  },
}
