import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { ApiKeyAuthAdapter } from './auth-adapter.js'
import { buildRegistry } from './build-registry.js'
import type { ToolDefinition, ToolRegistry } from './registry.js'

export { ToolRegistry, type ToolDefinition, type ToolMetadata } from './registry.js'
export { SessionAuthAdapter, ApiKeyAuthAdapter, type AuthAdapter } from './auth-adapter.js'
export { registerUiTools } from './tools/ui.js'
export { registerCompositeTools } from './tools/composite.js'
export { buildRegistry } from './build-registry.js'

export type ScopeFilter = {
  scope?: 'read' | 'write' | 'all'
  domains?: string[]
  includeUi?: boolean
}

export function filterTools(registry: ToolRegistry, filter: ScopeFilter = {}): ToolDefinition[] {
  const scope = filter.scope ?? 'all'
  const includeUi = filter.includeUi ?? false
  const domains = filter.domains?.length ? new Set(filter.domains) : null

  return registry.getAll().filter(tool => {
    if (!includeUi && tool.metadata.domain === 'ui') return false
    if (domains && !domains.has(tool.metadata.domain)) return false
    if (scope === 'read' && tool.metadata.isWrite) return false
    if (scope === 'write' && !tool.metadata.isWrite) return false
    return true
  })
}

export function mountRegistryOnServer(
  server: McpServer,
  registry: ToolRegistry,
  auth: ApiKeyAuthAdapter,
  filter: ScopeFilter = {}
): number {
  const tools = filterTools(registry, filter)

  for (const tool of tools) {
    const shape = tool.zodSchema instanceof z.ZodObject ? tool.zodSchema.shape : {}
    const description =
      tool.metadata.confirmRequired && tool.metadata.isWrite
        ? `${tool.description}\n\n⚠️ Write operation — this mutates live data.`
        : tool.description

    const annotations = {
      readOnlyHint: !tool.metadata.isWrite,
      destructiveHint: tool.metadata.isWrite && (tool.metadata.method === 'DELETE' || tool.metadata.confirmRequired),
      idempotentHint: tool.metadata.method === 'GET' || tool.metadata.method === 'PUT' || tool.metadata.method === 'DELETE',
      openWorldHint: true,
    }

    server.registerTool(
      tool.name,
      { description, inputSchema: shape, annotations },
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.handler(args, auth)
          const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          const isError =
            result !== null &&
            typeof result === 'object' &&
            'error' in result &&
            (result as { error: unknown }).error === true
          return { content: [{ type: 'text' as const, text }], isError: isError || undefined }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true }
        }
      }
    )
  }

  return tools.length
}

function parseScope(value: string | undefined): 'read' | 'write' | 'all' {
  if (value === 'read' || value === 'write' || value === 'all') return value
  return 'all'
}

function parseDomains(value: string | undefined): string[] | undefined {
  if (!value) return undefined
  const list = value.split(',').map(s => s.trim()).filter(Boolean)
  return list.length ? list : undefined
}

export function createServer(config: {
  baseUrl: string
  apiKey: string
  filter?: ScopeFilter
}) {
  const server = new McpServer({
    name: 'iscale-lead-routing',
    version: '0.1.0',
  })
  const auth = new ApiKeyAuthAdapter(config.apiKey, config.baseUrl)
  const registry = buildRegistry()
  mountRegistryOnServer(server, registry, auth, config.filter)
  return server
}

export async function startServer() {
  const baseUrl = process.env.ISCALE_API_URL
  const apiKey = process.env.ISCALE_API_KEY

  if (!baseUrl) {
    console.error('ISCALE_API_URL environment variable is required')
    process.exit(1)
  }
  if (!apiKey) {
    console.error('ISCALE_API_KEY environment variable is required')
    process.exit(1)
  }

  const filter: ScopeFilter = {
    scope: parseScope(process.env.ISCALE_MCP_SCOPE),
    domains: parseDomains(process.env.ISCALE_MCP_DOMAINS),
    includeUi: process.env.ISCALE_MCP_INCLUDE_UI === 'true',
  }

  const server = createServer({ baseUrl, apiKey, filter })
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
