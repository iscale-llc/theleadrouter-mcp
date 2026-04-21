import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ApiClient } from '../api-client.js'

export function registerVerticalTools(server: McpServer, api: ApiClient) {
  server.tool(
    'list_verticals',
    'List all verticals (lead categories like insurance, solar, etc.).',
    {
      limit: z.number().default(20).describe('Max results to return'),
      offset: z.number().default(0).describe('Offset for pagination'),
    },
    async (args) => {
      const params: Record<string, string> = {
        limit: String(args.limit),
        offset: String(args.offset),
      }

      const res = await api.get<Array<Record<string, unknown>>>('/api/v1/verticals', params)

      if (res.error) {
        return { content: [{ type: 'text' as const, text: `Error: ${res.error.message}` }], isError: true }
      }

      const verticals = res.data ?? []
      if (verticals.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No verticals found.' }] }
      }

      const total = res.pagination?.total ?? verticals.length
      const lines = verticals.map((v) =>
        `- **${v.name}** | ${v.fieldCount ?? 0} fields | ${v.customFieldCount ?? 0} custom fields`
      )
      const text = `Found ${total} verticals (showing ${verticals.length}):\n\n${lines.join('\n')}`
      return { content: [{ type: 'text' as const, text }] }
    }
  )
}
