import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ApiClient } from '../api-client.js'

export function registerPartnerTools(server: McpServer, api: ApiClient) {
  server.tool(
    'list_partners',
    'List partners with optional filters for status and keyword search.',
    {
      status: z.string().optional().describe('Filter by partner status'),
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

      const res = await api.get<Array<Record<string, unknown>>>('/api/v1/partners', params)

      if (res.error) {
        return { content: [{ type: 'text' as const, text: `Error: ${res.error.message}` }], isError: true }
      }

      const partners = res.data ?? []
      if (partners.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No partners found.' }] }
      }

      const total = res.pagination?.total ?? partners.length
      const lines = partners.map((p) =>
        `- **${p.name}** (#${p.displayId ?? p.id}) | ${p.status} | ${p.email ?? 'no email'}`
      )
      const text = `Found ${total} partners (showing ${partners.length}):\n\n${lines.join('\n')}`
      return { content: [{ type: 'text' as const, text }] }
    }
  )
}
