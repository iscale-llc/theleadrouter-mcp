import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ApiClient } from '../api-client.js'

export function registerCampaignTools(server: McpServer, api: ApiClient) {
  server.tool(
    'list_campaigns',
    'List campaigns with optional filters for partner, vertical, status, and keyword search.',
    {
      partnerId: z.string().optional().describe('Filter by partner ID'),
      verticalId: z.string().optional().describe('Filter by vertical ID'),
      status: z.string().optional().describe('Filter by campaign status'),
      search: z.string().optional().describe('Keyword search'),
      limit: z.number().default(20).describe('Max results to return'),
      offset: z.number().default(0).describe('Offset for pagination'),
    },
    async (args) => {
      const params: Record<string, string> = {}
      if (args.partnerId) params.partnerId = args.partnerId
      if (args.verticalId) params.verticalId = args.verticalId
      if (args.status) params.status = args.status
      if (args.search) params.search = args.search
      params.limit = String(args.limit)
      params.offset = String(args.offset)

      const res = await api.get<Array<Record<string, unknown>>>('/api/v1/campaigns', params)

      if (res.error) {
        return { content: [{ type: 'text' as const, text: `Error: ${res.error.message}` }], isError: true }
      }

      const campaigns = res.data ?? []
      if (campaigns.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No campaigns found.' }] }
      }

      const total = res.pagination?.total ?? campaigns.length
      const lines = campaigns.map((c) =>
        `- **${c.name}** | Partner: ${c.partnerName ?? c.partnerId} | ${c.status}`
      )
      const text = `Found ${total} campaigns (showing ${campaigns.length}):\n\n${lines.join('\n')}`
      return { content: [{ type: 'text' as const, text }] }
    }
  )

  server.tool(
    'get_posting_instructions',
    'Get posting instructions for a campaign (URL, posting key, required fields).',
    {
      campaignId: z.string().describe('The campaign ID'),
    },
    async (args) => {
      const res = await api.get<Record<string, unknown>>(`/api/v1/campaigns/${args.campaignId}/posting`)

      if (res.error) {
        return { content: [{ type: 'text' as const, text: `Error: ${res.error.message}` }], isError: true }
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    }
  )
}
