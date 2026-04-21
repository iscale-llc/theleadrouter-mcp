import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ApiClient } from '../api-client.js'

export function registerLeadTools(server: McpServer, api: ApiClient) {
  server.tool(
    'search_leads',
    'Search leads with optional filters for status, vertical, partner, buyer, date range, and keyword.',
    {
      status: z.string().optional().describe('Filter by lead status'),
      verticalId: z.string().optional().describe('Filter by vertical ID'),
      partnerId: z.string().optional().describe('Filter by partner ID'),
      buyerId: z.string().optional().describe('Filter by buyer ID'),
      dateFrom: z.string().optional().describe('Start date (ISO8601)'),
      dateTo: z.string().optional().describe('End date (ISO8601)'),
      search: z.string().optional().describe('Keyword search'),
      limit: z.number().default(20).describe('Max results to return'),
      offset: z.number().default(0).describe('Offset for pagination'),
    },
    async (args) => {
      const params: Record<string, string> = {}
      if (args.status) params.status = args.status
      if (args.verticalId) params.verticalId = args.verticalId
      if (args.partnerId) params.partnerId = args.partnerId
      if (args.buyerId) params.buyerId = args.buyerId
      if (args.dateFrom) params.dateFrom = args.dateFrom
      if (args.dateTo) params.dateTo = args.dateTo
      if (args.search) params.search = args.search
      params.limit = String(args.limit)
      params.offset = String(args.offset)

      const res = await api.get<Array<Record<string, unknown>>>('/api/v1/leads', params)

      if (res.error) {
        return { content: [{ type: 'text' as const, text: `Error: ${res.error.message}` }], isError: true }
      }

      const leads = res.data ?? []
      if (leads.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No leads found.' }] }
      }

      const total = res.pagination?.total ?? leads.length
      const lines = leads.map((l) =>
        `- **${l.shortId ?? l.id}** | ${l.firstName} ${l.lastName} | ${l.email} | ${l.status} | ${l.createdAt}`
      )
      const text = `Found ${total} leads (showing ${leads.length}):\n\n${lines.join('\n')}`
      return { content: [{ type: 'text' as const, text }] }
    }
  )

  server.tool(
    'get_lead',
    'Get full details for a single lead by ID.',
    {
      leadId: z.string().describe('The lead ID'),
    },
    async (args) => {
      const res = await api.get<Record<string, unknown>>(`/api/v1/leads/${args.leadId}`)

      if (res.error) {
        return { content: [{ type: 'text' as const, text: `Error: ${res.error.message}` }], isError: true }
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    }
  )

  server.tool(
    'get_lead_distributions',
    'Get the distribution waterfall for a lead showing each contract evaluation.',
    {
      leadId: z.string().describe('The lead ID'),
    },
    async (args) => {
      const res = await api.get<Array<Record<string, unknown>>>(`/api/v1/leads/${args.leadId}/distributions`)

      if (res.error) {
        return { content: [{ type: 'text' as const, text: `Error: ${res.error.message}` }], isError: true }
      }

      const dists = res.data ?? []
      if (dists.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No distributions found for this lead.' }] }
      }

      const lines = dists.map((d) =>
        `  #${d.rank} | ${d.contractName} | Buyer: ${d.buyerName} | ${d.disposition} | $${d.price}`
      )
      const text = `Distribution waterfall (${dists.length} entries):\n\n${lines.join('\n')}`
      return { content: [{ type: 'text' as const, text }] }
    }
  )
}
