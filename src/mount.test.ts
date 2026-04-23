import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ToolRegistry } from './registry.js'
import { ApiKeyAuthAdapter } from './auth-adapter.js'
import { mountRegistryOnServer, filterTools } from './index.js'
import { buildRegistry } from './build-registry.js'

function makeRegistry() {
  const reg = new ToolRegistry()
  reg.register({
    name: 'list_things',
    description: 'List things',
    zodSchema: z.object({}),
    handler: async () => ({ data: [] }),
    metadata: {
      domain: 'things', isWrite: false, confirmRequired: false,
      method: 'GET', path: '/things', tags: [], summary: 'List things',
    },
  })
  reg.register({
    name: 'create_thing',
    description: 'Create a thing',
    zodSchema: z.object({ name: z.string() }),
    handler: async (args) => ({ id: 'x', name: args.name }),
    metadata: {
      domain: 'things', isWrite: true, confirmRequired: true,
      method: 'POST', path: '/things', tags: [], summary: 'Create thing',
    },
  })
  reg.register({
    name: 'navigate_to',
    description: 'UI nav',
    zodSchema: z.object({ path: z.string() }),
    handler: async () => ({ action: 'navigate' }),
    metadata: {
      domain: 'ui', isWrite: false, confirmRequired: false,
      method: 'INLINE', path: '', tags: [], summary: 'Nav',
    },
  })
  return reg
}

describe('filterTools', () => {
  it('default excludes UI tools', () => {
    const names = filterTools(makeRegistry()).map(t => t.name)
    expect(names).toEqual(['list_things', 'create_thing'])
  })

  it('scope=read filters out writes', () => {
    const names = filterTools(makeRegistry(), { scope: 'read' }).map(t => t.name)
    expect(names).toEqual(['list_things'])
  })

  it('scope=write filters out reads', () => {
    const names = filterTools(makeRegistry(), { scope: 'write' }).map(t => t.name)
    expect(names).toEqual(['create_thing'])
  })

  it('domains filter restricts by domain', () => {
    const names = filterTools(makeRegistry(), { domains: ['ui'], includeUi: true }).map(t => t.name)
    expect(names).toEqual(['navigate_to'])
  })

  it('includeUi=true surfaces UI tools', () => {
    const names = filterTools(makeRegistry(), { includeUi: true }).map(t => t.name)
    expect(names).toContain('navigate_to')
  })
})

describe('mountRegistryOnServer', () => {
  it('registers registry tools on McpServer and wraps JSON results in MCP content', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' })
    const registry = makeRegistry()
    const auth = new ApiKeyAuthAdapter('key', 'http://unused')
    const count = mountRegistryOnServer(server, registry, auth)
    expect(count).toBe(2)
  })

  it('buildRegistry produces the full tool set including writes', () => {
    const reg = buildRegistry()
    const all = reg.getAll()
    expect(all.length).toBeGreaterThan(100)
    const writes = all.filter(t => t.metadata.isWrite)
    expect(writes.length).toBeGreaterThan(20)
    const create = all.find(t => t.name === 'create_vertical')
    expect(create).toBeDefined()
    expect(create?.metadata.isWrite).toBe(true)
  })
})
