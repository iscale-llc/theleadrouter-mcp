import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ApiClient } from '../api-client.js'

export function registerBuyerTools(server: McpServer, api: ApiClient) {
  server.tool(
    'list_buyers',
    'List buyers with optional filters for status and keyword search.',
    {
      status: z.string().optional().describe('Filter by buyer status'),
      search: z.string().optional().describe('Keyword search'),
      limit: z.number().default(20).describe('Max results to return'),
      offset: z.number().default(0).describe('Offset for pagination'),
    },
    async (args) => {
      const params: Record<string, string> = {}
      if (args.status) params.status = args.status
      if (args.search) params.search = args.search
      params.limit = String(args.limit)
      params.offset = String(args.offset)

      const res = await api.get<Array<Record<string, unknown>>>('/api/v1/buyers', params)

      if (res.error) {
        return { content: [{ type: 'text' as const, text: `Error: ${res.error.message}` }], isError: true }
      }

      const buyers = res.data ?? []
      if (buyers.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No buyers found.' }] }
      }

      const total = res.pagination?.total ?? buyers.length
      const lines = buyers.map((b) =>
        `- **${b.name}** (#${b.displayId ?? b.id}) | ${b.status} | Balance: $${b.balance ?? 0}`
      )
      const text = `Found ${total} buyers (showing ${buyers.length}):\n\n${lines.join('\n')}`
      return { content: [{ type: 'text' as const, text }] }
    }
  )

  server.tool(
    'get_buyer_balance',
    'Get the current balance and billing details for a buyer.',
    {
      buyerId: z.string().describe('The buyer ID'),
    },
    async (args) => {
      const res = await api.get<Record<string, unknown>>(`/api/v1/buyers/${args.buyerId}/balance`)

      if (res.error) {
        return { content: [{ type: 'text' as const, text: `Error: ${res.error.message}` }], isError: true }
      }

      const d = res.data
      if (!d) {
        return { content: [{ type: 'text' as const, text: 'No balance data returned.' }] }
      }

      const text = [
        `Buyer Balance:`,
        `  Balance: $${d.balance}`,
        `  Credit Limit: $${d.creditLimit ?? 'N/A'}`,
        `  Available: $${d.available ?? 'N/A'}`,
      ].join('\n')
      return { content: [{ type: 'text' as const, text }] }
    }
  )

  server.tool(
    'update_buyer_status',
    'Update a buyer\'s status (e.g. active, paused, disabled).',
    {
      buyerId: z.string().describe('The buyer ID'),
      status: z.string().describe('New status value'),
    },
    async (args) => {
      const res = await api.patch<Record<string, unknown>>(`/api/v1/buyers/${args.buyerId}/status`, {
        status: args.status,
      })

      if (res.error) {
        return { content: [{ type: 'text' as const, text: `Error: ${res.error.message}` }], isError: true }
      }

      return { content: [{ type: 'text' as const, text: `Buyer ${args.buyerId} status updated to "${args.status}".` }] }
    }
  )
}
