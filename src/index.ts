import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ApiClient } from './api-client.js'
import { registerAllTools } from './register.js'

export { ToolRegistry, type ToolDefinition, type ToolMetadata } from './registry.js'
export { SessionAuthAdapter, ApiKeyAuthAdapter, type AuthAdapter } from './auth-adapter.js'
export { registerUiTools } from './tools/ui.js'
export { registerCompositeTools } from './tools/composite.js'
export { buildRegistry } from './build-registry.js'

export function createServer(config: { baseUrl: string; apiKey: string }) {
  const server = new McpServer({
    name: 'iscale-lead-routing',
    version: '0.1.0',
  })
  const api = new ApiClient(config)
  registerAllTools(server, api)
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

  const server = createServer({ baseUrl, apiKey })
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
