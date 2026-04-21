import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ApiClient } from '../api-client.js'

export function registerOfferTools(server: McpServer, api: ApiClient) {
  server.tool(
    'list_offers',
    'List offers with optional filters for vertical, status, and keyword search.',
    {
      verticalId: z.string().optional().describe('Filter by vertical ID'),
      status: z.string().optional().describe('Filter by offer status'),
      search: z.string().optional().describe('Keyword search'),
      limit: z.number().default(20).describe('Max results to return'),
      offset: z.number().default(0).describe('Offset for pagination'),
    },
    async (args) => {
      const params: Record<string, string> = {}
      if (args.verticalId) params.verticalId = args.verticalId
      if (args.status) params.status = args.status
      if (args.search) params.search = args.search
      params.limit = String(args.limit)
      params.offset = String(args.offset)

      const res = await api.get<Array<Record<string, unknown>>>('/api/v1/offers', params)

      if (res.error) {
        return { content: [{ type: 'text' as const, text: `Error: ${res.error.message}` }], isError: true }
      }

      const offers = res.data ?? []
      if (offers.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No offers found.' }] }
      }

      const total = res.pagination?.total ?? offers.length
      const lines = offers.map((o) =>
        `- **${o.name}** | ${o.distributionType} | ${o.distributionRule} | ${o.status}`
      )
      const text = `Found ${total} offers (showing ${offers.length}):\n\n${lines.join('\n')}`
      return { content: [{ type: 'text' as const, text }] }
    }
  )
}
