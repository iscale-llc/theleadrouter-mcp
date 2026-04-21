import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ApiClient } from '../api-client.js'

export function registerComplianceTools(server: McpServer, api: ApiClient) {
  server.tool(
    'check_suppression',
    'Check if an email or phone number is on any suppression list.',
    {
      type: z.enum(['email', 'phone']).describe('Type of value to check'),
      value: z.string().describe('The email or phone number to check'),
    },
    async (args) => {
      const res = await api.post<Record<string, unknown>>('/api/v1/suppression/check', {
        type: args.type,
        value: args.value,
      })

      if (res.error) {
        return { content: [{ type: 'text' as const, text: `Error: ${res.error.message}` }], isError: true }
      }

      const d = res.data
      if (!d) {
        return { content: [{ type: 'text' as const, text: 'Error: No response data.' }], isError: true }
      }

      if (d.suppressed) {
        return {
          content: [{ type: 'text' as const, text: `SUPPRESSED: ${args.value} is on suppression list "${d.listName}".` }],
        }
      }

      return {
        content: [{ type: 'text' as const, text: `NOT SUPPRESSED: ${args.value} is not on any suppression list.` }],
      }
    }
  )
}
