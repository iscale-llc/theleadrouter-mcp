import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ApiClient } from '../api-client.js'

export function registerReportTools(server: McpServer, api: ApiClient) {
  server.tool(
    'get_report',
    'Get a report by type (leads, revenue, by-buyer) with optional date range and entity filters.',
    {
      type: z.enum(['leads', 'revenue', 'by-buyer']).describe('Report type'),
      dateFrom: z.string().optional().describe('Start date (ISO8601)'),
      dateTo: z.string().optional().describe('End date (ISO8601)'),
      verticalId: z.string().optional().describe('Filter by vertical ID'),
      buyerId: z.string().optional().describe('Filter by buyer ID'),
      partnerId: z.string().optional().describe('Filter by partner ID'),
    },
    async (args) => {
      const params: Record<string, string> = { type: args.type }
      if (args.dateFrom) params.dateFrom = args.dateFrom
      if (args.dateTo) params.dateTo = args.dateTo
      if (args.verticalId) params.verticalId = args.verticalId
      if (args.buyerId) params.buyerId = args.buyerId
      if (args.partnerId) params.partnerId = args.partnerId

      const res = await api.get<Record<string, unknown>>('/api/v1/reports', params)

      if (res.error) {
        return { content: [{ type: 'text' as const, text: `Error: ${res.error.message}` }], isError: true }
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    }
  )

  server.tool(
    'list_transactions',
    'List financial transactions with optional filters for type, entity, buyer, partner, and date range.',
    {
      type: z.string().optional().describe('Transaction type filter'),
      entityType: z.string().optional().describe('Entity type filter'),
      buyerId: z.string().optional().describe('Filter by buyer ID'),
      partnerId: z.string().optional().describe('Filter by partner ID'),
      dateFrom: z.string().optional().describe('Start date (ISO8601)'),
      dateTo: z.string().optional().describe('End date (ISO8601)'),
      limit: z.number().default(20).describe('Max results to return'),
      offset: z.number().default(0).describe('Offset for pagination'),
    },
    async (args) => {
      const params: Record<string, string> = {}
      if (args.type) params.type = args.type
      if (args.entityType) params.entityType = args.entityType
      if (args.buyerId) params.buyerId = args.buyerId
      if (args.partnerId) params.partnerId = args.partnerId
      if (args.dateFrom) params.dateFrom = args.dateFrom
      if (args.dateTo) params.dateTo = args.dateTo
      params.limit = String(args.limit)
      params.offset = String(args.offset)

      const res = await api.get<Array<Record<string, unknown>>>('/api/v1/transactions', params)

      if (res.error) {
        return { content: [{ type: 'text' as const, text: `Error: ${res.error.message}` }], isError: true }
      }

      const txns = res.data ?? []
      if (txns.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No transactions found.' }] }
      }

      const total = res.pagination?.total ?? txns.length
      const lines = txns.map((t) =>
        `- ${t.createdAt} | ${t.type} | ${t.entityType}:${t.entityId} | $${t.amount} | ${t.description ?? ''}`
      )
      const text = `Found ${total} transactions (showing ${txns.length}):\n\n${lines.join('\n')}`
      return { content: [{ type: 'text' as const, text }] }
    }
  )
}
