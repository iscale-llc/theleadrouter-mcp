import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ApiClient } from '../api-client.js'

export function registerPeopleTools(server: McpServer, api: ApiClient) {
  server.tool(
    'search_people',
    'Search people (lead contacts) with optional filters for keyword, state, and status.',
    {
      search: z.string().optional().describe('Keyword search (name, email, phone)'),
      state: z.string().optional().describe('Filter by US state code'),
      status: z.string().optional().describe('Filter by person status'),
      limit: z.number().default(20).describe('Max results to return'),
      offset: z.number().default(0).describe('Offset for pagination'),
    },
    async (args) => {
      const params: Record<string, string> = {}
      if (args.search) params.search = args.search
      if (args.state) params.state = args.state
      if (args.status) params.status = args.status
      params.limit = String(args.limit)
      params.offset = String(args.offset)

      const res = await api.get<Array<Record<string, unknown>>>('/api/v1/people', params)

      if (res.error) {
        return { content: [{ type: 'text' as const, text: `Error: ${res.error.message}` }], isError: true }
      }

      const people = res.data ?? []
      if (people.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No people found.' }] }
      }

      const total = res.pagination?.total ?? people.length
      const lines = people.map((p) =>
        `- **${p.firstName} ${p.lastName}** | ${p.email ?? 'no email'} | ${p.phone ?? 'no phone'} | ${p.state ?? 'N/A'}`
      )
      const text = `Found ${total} people (showing ${people.length}):\n\n${lines.join('\n')}`
      return { content: [{ type: 'text' as const, text }] }
    }
  )

  server.tool(
    'get_person_timeline',
    'Get the activity timeline for a person showing all lead events and interactions.',
    {
      personId: z.string().describe('The person ID'),
    },
    async (args) => {
      const res = await api.get<Record<string, unknown>>(`/api/v1/people/${args.personId}/timeline`)

      if (res.error) {
        return { content: [{ type: 'text' as const, text: `Error: ${res.error.message}` }], isError: true }
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    }
  )
}
