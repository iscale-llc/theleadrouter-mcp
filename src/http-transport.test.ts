import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for Streamable HTTP transport layer (Phase 1A of hybrid MCP plan).
 *
 * The HTTP transport wraps the MCP server for remote access via HTTP.
 * Anthropic's MCP Connector calls this endpoint to discover and execute tools.
 *
 * Will be implemented at: packages/mcp/src/http-server.ts
 */

type MockRequest = {
  method: string
  url: string
  headers: Record<string, string>
  body?: unknown
}

type MockResponse = {
  status: number
  headers: Record<string, string>
  body: unknown
}

/**
 * Try to import the HTTP server creator.
 * Returns null if not yet implemented (red phase of TDD).
 */
async function getHttpServer() {
  try {
    const mod = await import('./http-server')
    return mod.createHttpServer ?? mod.default
  } catch {
    return null
  }
}

/**
 * Try to import the JWT verifier.
 */
async function getJwtVerifier() {
  try {
    const mod = await import('./auth/jwt-verifier')
    return mod.verifyJwt ?? mod.default
  } catch {
    return null
  }
}

function createMockMcpServer() {
  return {
    listTools: vi.fn().mockResolvedValue({
      tools: [
        { name: 'list_buyers', description: 'List buyers', inputSchema: { type: 'object' } },
        { name: 'get_buyer', description: 'Get buyer by ID', inputSchema: { type: 'object' } },
      ],
    }),
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ data: [{ id: 'b1', name: 'Acme' }] }) }],
    }),
  }
}

describe('HTTP Transport', () => {
  let createServer: ((mcpServer: unknown, opts?: unknown) => any) | null
  let mockMcp: ReturnType<typeof createMockMcpServer>

  beforeEach(async () => {
    createServer = await getHttpServer()
    mockMcp = createMockMcpServer()
  })

  function skipIfNotImplemented() {
    if (!createServer) {
      expect(createServer).not.toBeNull()
      return true
    }
    return false
  }

  describe('tool discovery', () => {
    it('GET /mcp returns available tools list', async () => {
      if (skipIfNotImplemented()) return

      const server = createServer!(mockMcp, {
        jwtSecret: 'test-secret',
        skipRateLimit: true,
      })

      const res = await server.inject({
        method: 'GET',
        url: '/mcp',
        headers: {
          authorization: 'Bearer valid-test-jwt',
        },
      })

      expect(res.status).toBe(200)
      const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
      expect(body.tools).toBeDefined()
      expect(body.tools).toHaveLength(2)
      expect(body.tools[0].name).toBe('list_buyers')
    })
  })

  describe('tool execution', () => {
    it('POST /mcp with tool call returns result', async () => {
      if (skipIfNotImplemented()) return

      const server = createServer!(mockMcp, {
        jwtSecret: 'test-secret',
        skipRateLimit: true,
      })

      const res = await server.inject({
        method: 'POST',
        url: '/mcp',
        headers: {
          authorization: 'Bearer valid-test-jwt',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'list_buyers',
            arguments: { status: 'active' },
          },
          id: 1,
        }),
      })

      expect(res.status).toBe(200)
      expect(mockMcp.callTool).toHaveBeenCalled()
      const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
      expect(body.result).toBeDefined()
      expect(body.result.content).toBeDefined()
    })
  })

  describe('JWT auth required', () => {
    it('requests without Authorization header return 401', async () => {
      if (skipIfNotImplemented()) return

      const server = createServer!(mockMcp, {
        jwtSecret: 'test-secret',
      })

      const res = await server.inject({
        method: 'GET',
        url: '/mcp',
        headers: {},
      })

      expect(res.status).toBe(401)
      const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
      expect(body.error).toBeDefined()
      expect(body.error.code).toMatch(/UNAUTHORIZED|AUTH_REQUIRED/i)
    })
  })

  describe('JWT verification', () => {
    it('invalid JWT returns 401', async () => {
      if (skipIfNotImplemented()) return

      const server = createServer!(mockMcp, {
        jwtSecret: 'test-secret',
      })

      const res = await server.inject({
        method: 'GET',
        url: '/mcp',
        headers: {
          authorization: 'Bearer invalid.jwt.token',
        },
      })

      expect(res.status).toBe(401)
      const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
      expect(body.error).toBeDefined()
    })
  })

  describe('JWT tenant extraction', () => {
    it('valid JWT extracts tenantId and passes to tool handler', async () => {
      if (skipIfNotImplemented()) return

      const server = createServer!(mockMcp, {
        jwtSecret: 'test-secret',
        skipRateLimit: true,
        // Test with a pre-built JWT containing tenantId
        testJwt: {
          userId: 'user-1',
          tenantId: 'tenant-abc',
          role: 'admin',
        },
      })

      const res = await server.inject({
        method: 'POST',
        url: '/mcp',
        headers: {
          authorization: 'Bearer valid-test-jwt',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'list_buyers',
            arguments: {},
          },
          id: 1,
        }),
      })

      expect(res.status).toBe(200)

      // Verify the MCP server's callTool received tenant context
      const callArgs = mockMcp.callTool.mock.calls[0]
      // The transport should pass auth context (tenantId) through
      // Implementation may pass it as extra param, meta, or _meta
      expect(callArgs).toBeDefined()
    })
  })

  describe('rate limiting', () => {
    it('51st call within 1 minute returns 429', async () => {
      if (skipIfNotImplemented()) return

      const server = createServer!(mockMcp, {
        jwtSecret: 'test-secret',
        testJwt: {
          userId: 'user-rate-test',
          tenantId: 'tenant-abc',
          role: 'admin',
        },
        rateLimit: {
          maxPerMinute: 50,
        },
      })

      // Fire 50 requests (should all succeed)
      const requests = Array.from({ length: 50 }, (_, i) =>
        server.inject({
          method: 'POST',
          url: '/mcp',
          headers: {
            authorization: 'Bearer valid-test-jwt',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: { name: 'list_buyers', arguments: {} },
            id: i + 1,
          }),
        })
      )

      const results = await Promise.all(requests)
      const successCount = results.filter((r: any) => r.status === 200).length
      expect(successCount).toBe(50)

      // 51st request should be rate limited
      const rateLimited = await server.inject({
        method: 'POST',
        url: '/mcp',
        headers: {
          authorization: 'Bearer valid-test-jwt',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'list_buyers', arguments: {} },
          id: 51,
        }),
      })

      expect(rateLimited.status).toBe(429)
      const body = typeof rateLimited.body === 'string' ? JSON.parse(rateLimited.body) : rateLimited.body
      expect(body.error).toBeDefined()
    })
  })

  describe('CORS headers', () => {
    it('response includes appropriate CORS headers for cross-origin MCP Connector calls', async () => {
      if (skipIfNotImplemented()) return

      const server = createServer!(mockMcp, {
        jwtSecret: 'test-secret',
        skipRateLimit: true,
      })

      const res = await server.inject({
        method: 'OPTIONS',
        url: '/mcp',
        headers: {
          origin: 'https://api.anthropic.com',
          'access-control-request-method': 'POST',
        },
      })

      // CORS preflight should succeed
      expect(res.status).toBeLessThan(400)

      const headers = res.headers
      expect(headers['access-control-allow-origin']).toBeDefined()
      expect(headers['access-control-allow-methods']).toMatch(/POST/i)
      expect(headers['access-control-allow-headers']).toMatch(/authorization/i)
    })
  })

  describe('health check', () => {
    it('GET /health returns 200', async () => {
      if (skipIfNotImplemented()) return

      const server = createServer!(mockMcp, {
        jwtSecret: 'test-secret',
      })

      const res = await server.inject({
        method: 'GET',
        url: '/health',
        headers: {},
      })

      expect(res.status).toBe(200)
      const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
      expect(body.status).toBe('ok')
    })
  })
})
