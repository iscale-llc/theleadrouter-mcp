import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for ToolRegistry class (Phase 1C of hybrid MCP plan).
 *
 * The ToolRegistry manages all MCP tools with read/write annotations,
 * domain-based filtering, and Anthropic tool definition conversion.
 *
 * Will be implemented at: packages/mcp/src/registry.ts
 */

type ToolMetadata = {
  domain: string
  entity?: string
  isWrite: boolean
  confirmRequired: boolean
  method: string
  path: string
  tags: string[]
  summary: string
  annotations?: {
    readOnly?: boolean
    destructive?: boolean
    openWorld?: boolean
  }
}

type ToolDefinition = {
  name: string
  description: string
  zodSchema: unknown
  handler: (args: Record<string, unknown>, authAdapter: unknown) => Promise<unknown>
  metadata: ToolMetadata
}

async function getToolRegistry() {
  try {
    const mod = await import('./registry')
    return mod.ToolRegistry ?? mod.default
  } catch {
    return null
  }
}

function mockTool(overrides: Partial<ToolDefinition> & { name: string }): ToolDefinition {
  return {
    name: overrides.name,
    description: overrides.description ?? `Description for ${overrides.name}`,
    zodSchema: overrides.zodSchema ?? { type: 'object', properties: {} },
    handler: overrides.handler ?? vi.fn().mockResolvedValue({ data: 'ok' }),
    metadata: {
      domain: 'buyers',
      entity: 'buyer',
      isWrite: false,
      confirmRequired: false,
      method: 'GET',
      path: '/api/v1/buyers',
      tags: ['buyers'],
      summary: `Summary for ${overrides.name}`,
      ...overrides.metadata,
    },
  }
}

describe('ToolRegistry', () => {
  let ToolRegistry: new () => any
  let registry: any

  beforeEach(async () => {
    const Ctor = await getToolRegistry()
    if (!Ctor) {
      // Implementation doesn't exist yet — tests will fail with clear message
      ToolRegistry = null as any
      registry = null
      return
    }
    ToolRegistry = Ctor
    registry = new ToolRegistry()
  })

  function skipIfNotImplemented() {
    if (!ToolRegistry) {
      expect(ToolRegistry).not.toBeNull()
      return true
    }
    return false
  }

  describe('register + getAll', () => {
    it('registers 3 tools and getAll returns all 3', () => {
      if (skipIfNotImplemented()) return

      registry.register(mockTool({ name: 'list_buyers' }))
      registry.register(mockTool({ name: 'get_buyer' }))
      registry.register(mockTool({ name: 'list_leads' }))

      const all = registry.getAll()
      expect(all).toHaveLength(3)
      expect(all.map((t: any) => t.name)).toEqual(['list_buyers', 'get_buyer', 'list_leads'])
    })
  })

  describe('getByName', () => {
    it('returns the correct tool by name', () => {
      if (skipIfNotImplemented()) return

      registry.register(mockTool({ name: 'list_buyers' }))
      registry.register(mockTool({ name: 'get_buyer' }))

      const tool = registry.getByName('get_buyer')
      expect(tool).toBeDefined()
      expect(tool.name).toBe('get_buyer')
    })

    it('returns undefined for unknown tool name', () => {
      if (skipIfNotImplemented()) return

      registry.register(mockTool({ name: 'list_buyers' }))

      const tool = registry.getByName('nonexistent_tool')
      expect(tool).toBeUndefined()
    })
  })

  describe('getByDomain', () => {
    it('filters tools by domain metadata', () => {
      if (skipIfNotImplemented()) return

      registry.register(mockTool({ name: 'list_buyers', metadata: { domain: 'buyers' } as any }))
      registry.register(mockTool({ name: 'list_leads', metadata: { domain: 'leads' } as any }))
      registry.register(mockTool({ name: 'get_buyer', metadata: { domain: 'buyers' } as any }))

      const buyerTools = registry.getByDomain('buyers')
      expect(buyerTools).toHaveLength(2)
      expect(buyerTools.map((t: any) => t.name)).toEqual(['list_buyers', 'get_buyer'])
    })

    it('returns empty array for unknown domain', () => {
      if (skipIfNotImplemented()) return

      registry.register(mockTool({ name: 'list_buyers', metadata: { domain: 'buyers' } as any }))

      const result = registry.getByDomain('unknown_domain')
      expect(result).toEqual([])
    })
  })

  describe('toAnthropicTools', () => {
    it('converts Zod schemas to JSON Schema format for Anthropic', () => {
      if (skipIfNotImplemented()) return

      registry.register(mockTool({
        name: 'list_buyers',
        description: 'List all buyers',
        zodSchema: { type: 'object', properties: { status: { type: 'string' } } },
      }))

      const anthropicTools = registry.toAnthropicTools()
      expect(anthropicTools).toHaveLength(1)
      expect(anthropicTools[0]).toMatchObject({
        name: 'list_buyers',
        description: 'List all buyers',
        input_schema: expect.objectContaining({ type: 'object' }),
      })
    })

    it('converts only specified tools when name filter provided', () => {
      if (skipIfNotImplemented()) return

      registry.register(mockTool({ name: 'list_buyers' }))
      registry.register(mockTool({ name: 'get_buyer' }))
      registry.register(mockTool({ name: 'list_leads' }))

      const filtered = registry.toAnthropicTools(['list_buyers', 'list_leads'])
      expect(filtered).toHaveLength(2)
      expect(filtered.map((t: any) => t.name)).toEqual(['list_buyers', 'list_leads'])
    })
  })

  describe('execute', () => {
    it('calls handler with args and auth adapter, returns result', async () => {
      if (skipIfNotImplemented()) return

      const handler = vi.fn().mockResolvedValue({ data: { id: 'buyer-1', name: 'Acme' } })
      registry.register(mockTool({ name: 'get_buyer', handler }))

      const mockAuth = { tenantId: 'tenant-1', userId: 'user-1' }
      const result = await registry.execute('get_buyer', { buyerId: 'buyer-1' }, mockAuth)

      expect(handler).toHaveBeenCalledWith({ buyerId: 'buyer-1' }, mockAuth)
      expect(result).toEqual({ data: { id: 'buyer-1', name: 'Acme' } })
    })

    it('throws error for unknown tool', async () => {
      if (skipIfNotImplemented()) return

      await expect(
        registry.execute('nonexistent_tool', {}, {})
      ).rejects.toThrow(/not found|unknown|not registered/i)
    })
  })

  describe('getReadToolNames', () => {
    it('returns only tool names where metadata.isWrite === false', () => {
      if (skipIfNotImplemented()) return

      registry.register(mockTool({
        name: 'list_buyers',
        metadata: { isWrite: false, domain: 'buyers' } as any,
      }))
      registry.register(mockTool({
        name: 'create_buyer',
        metadata: { isWrite: true, domain: 'buyers' } as any,
      }))
      registry.register(mockTool({
        name: 'list_leads',
        metadata: { isWrite: false, domain: 'leads' } as any,
      }))

      const readNames = registry.getReadToolNames()
      expect(readNames).toEqual(['list_buyers', 'list_leads'])
      expect(readNames).not.toContain('create_buyer')
    })
  })

  describe('getWriteToolDefs', () => {
    it('returns Anthropic tool definitions for write tools only', () => {
      if (skipIfNotImplemented()) return

      registry.register(mockTool({
        name: 'list_buyers',
        metadata: { isWrite: false, domain: 'buyers' } as any,
      }))
      registry.register(mockTool({
        name: 'create_buyer',
        description: 'Create a new buyer',
        metadata: { isWrite: true, domain: 'buyers' } as any,
      }))
      registry.register(mockTool({
        name: 'update_buyer_status',
        description: 'Update buyer status',
        metadata: { isWrite: true, domain: 'buyers' } as any,
      }))

      const writeDefs = registry.getWriteToolDefs()
      expect(writeDefs).toHaveLength(2)
      expect(writeDefs.map((t: any) => t.name)).toEqual(['create_buyer', 'update_buyer_status'])
      // Each should have input_schema (Anthropic format)
      expect(writeDefs[0]).toHaveProperty('input_schema')
    })
  })

  describe('getCatalog', () => {
    it('returns metadata array for all registered tools', () => {
      if (skipIfNotImplemented()) return

      registry.register(mockTool({
        name: 'list_buyers',
        metadata: { domain: 'buyers', entity: 'buyer', isWrite: false, method: 'GET', path: '/api/v1/buyers' } as any,
      }))
      registry.register(mockTool({
        name: 'create_buyer',
        metadata: { domain: 'buyers', entity: 'buyer', isWrite: true, method: 'POST', path: '/api/v1/buyers' } as any,
      }))

      const catalog = registry.getCatalog()
      expect(catalog).toHaveLength(2)
      expect(catalog[0]).toMatchObject({
        name: 'list_buyers',
        domain: 'buyers',
        isWrite: false,
      })
      expect(catalog[1]).toMatchObject({
        name: 'create_buyer',
        domain: 'buyers',
        isWrite: true,
      })
    })
  })

  describe('priority override (first wins)', () => {
    it('skips registration when tool with same name already exists', () => {
      if (skipIfNotImplemented()) return

      const firstHandler = vi.fn().mockResolvedValue({ data: 'first' })
      const secondHandler = vi.fn().mockResolvedValue({ data: 'second' })

      registry.register(mockTool({ name: 'list_buyers', handler: firstHandler }))
      registry.register(mockTool({ name: 'list_buyers', handler: secondHandler }))

      const all = registry.getAll()
      expect(all).toHaveLength(1)

      // The first registered handler should be the one kept
      const tool = registry.getByName('list_buyers')
      expect(tool.handler).toBe(firstHandler)
    })
  })

  describe('metadata.confirmRequired', () => {
    it('is false for read tools', () => {
      if (skipIfNotImplemented()) return

      registry.register(mockTool({
        name: 'list_buyers',
        metadata: { isWrite: false, confirmRequired: false, domain: 'buyers' } as any,
      }))

      const tool = registry.getByName('list_buyers')
      expect(tool.metadata.confirmRequired).toBe(false)
    })

    it('is true for write tools on entity types', () => {
      if (skipIfNotImplemented()) return

      registry.register(mockTool({
        name: 'create_buyer',
        metadata: {
          isWrite: true,
          confirmRequired: true,
          entity: 'buyer',
          domain: 'buyers',
        } as any,
      }))

      const tool = registry.getByName('create_buyer')
      expect(tool.metadata.confirmRequired).toBe(true)
    })

    it('correctly reflects in catalog output', () => {
      if (skipIfNotImplemented()) return

      registry.register(mockTool({
        name: 'list_buyers',
        metadata: { isWrite: false, confirmRequired: false, domain: 'buyers' } as any,
      }))
      registry.register(mockTool({
        name: 'delete_buyer',
        metadata: { isWrite: true, confirmRequired: true, entity: 'buyer', domain: 'buyers' } as any,
      }))

      const catalog = registry.getCatalog()
      const readEntry = catalog.find((c: any) => c.name === 'list_buyers')
      const writeEntry = catalog.find((c: any) => c.name === 'delete_buyer')

      expect(readEntry.confirmRequired).toBe(false)
      expect(writeEntry.confirmRequired).toBe(true)
    })
  })
})
