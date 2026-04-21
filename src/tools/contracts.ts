import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ApiClient } from '../api-client.js'

export function registerContractTools(server: McpServer, api: ApiClient) {
  server.tool(
    'list_contracts',
    'List contracts with optional filters for buyer, vertical, status, and keyword search.',
    {
      buyerId: z.string().optional().describe('Filter by buyer ID'),
      verticalId: z.string().optional().describe('Filter by vertical ID'),
      status: z.string().optional().describe('Filter by contract status'),
      search: z.string().optional().describe('Keyword search'),
      limit: z.number().default(20).describe('Max results to return'),
      offset: z.number().default(0).describe('Offset for pagination'),
    },
    async (args) => {
      const params: Record<string, string> = {}
      if (args.buyerId) params.buyerId = args.buyerId
      if (args.verticalId) params.verticalId = args.verticalId
      if (args.status) params.status = args.status
      if (args.search) params.search = args.search
      params.limit = String(args.limit)
      params.offset = String(args.offset)

      const res = await api.get<Array<Record<string, unknown>>>('/api/v1/contracts', params)

      if (res.error) {
        return { content: [{ type: 'text' as const, text: `Error: ${res.error.message}` }], isError: true }
      }

      const contracts = res.data ?? []
      if (contracts.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No contracts found.' }] }
      }

      const total = res.pagination?.total ?? contracts.length
      const lines = contracts.map((c) =>
        `- **${c.name}** | Buyer: ${c.buyerName ?? c.buyerId} | ${c.status} | Price: $${c.price ?? 0}`
      )
      const text = `Found ${total} contracts (showing ${contracts.length}):\n\n${lines.join('\n')}`
      return { content: [{ type: 'text' as const, text }] }
    }
  )

  server.tool(
    'update_contract_status',
    'Update a contract\'s status (e.g. active, paused, disabled).',
    {
      contractId: z.string().describe('The contract ID'),
      status: z.string().describe('New status value'),
    },
    async (args) => {
      const res = await api.patch<Record<string, unknown>>(`/api/v1/contracts/${args.contractId}/status`, {
        status: args.status,
      })

      if (res.error) {
        return { content: [{ type: 'text' as const, text: `Error: ${res.error.message}` }], isError: true }
      }

      return { content: [{ type: 'text' as const, text: `Contract ${args.contractId} status updated to "${args.status}".` }] }
    }
  )
}
