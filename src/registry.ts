import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { AuthAdapter } from './auth-adapter.js'

export type ToolMetadata = {
  domain: string
  entity?: string
  isWrite: boolean
  confirmRequired: boolean
  method: string
  path: string
  tags: string[]
  summary: string
  allowedRoles?: string[]
  annotations?: {
    readOnly?: boolean
    destructive?: boolean
    openWorld?: boolean
  }
}

export type ToolDefinition = {
  name: string
  description: string
  zodSchema: z.ZodType | object
  handler: (args: Record<string, unknown>, authAdapter: AuthAdapter) => Promise<unknown>
  metadata: ToolMetadata
}

type AnthropicTool = {
  name: string
  description: string
  input_schema: object
}

type CatalogEntry = ToolMetadata & { name: string }

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()
  private jsonSchemaCache = new Map<string, object>()

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) return
    this.tools.set(tool.name, tool)
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  getByName(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  getByDomain(domain: string): ToolDefinition[] {
    return this.getAll().filter(t => t.metadata.domain === domain)
  }

  toAnthropicTools(names?: string[]): AnthropicTool[] {
    const tools = names
      ? names.map(n => this.tools.get(n)).filter((t): t is ToolDefinition => t !== undefined)
      : this.getAll()

    return tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: this.toJsonSchema(t),
    }))
  }

  async execute(name: string, args: unknown, auth: AuthAdapter): Promise<unknown> {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`Tool not found: ${name}`)
    return tool.handler(args as Record<string, unknown>, auth)
  }

  getCatalog(): CatalogEntry[] {
    return this.getAll().map(t => ({
      name: t.name,
      ...t.metadata,
    }))
  }

  getReadToolNames(): string[] {
    return this.getAll().filter(t => !t.metadata.isWrite).map(t => t.name)
  }

  getWriteToolDefs(): AnthropicTool[] {
    const writeNames = this.getAll().filter(t => t.metadata.isWrite).map(t => t.name)
    return this.toAnthropicTools(writeNames)
  }

  private toJsonSchema(tool: ToolDefinition): object {
    if (this.jsonSchemaCache.has(tool.name)) {
      return this.jsonSchemaCache.get(tool.name)!
    }

    let schema: object
    if (tool.zodSchema instanceof z.ZodType) {
      // Convert Zod schema to JSON Schema
      const jsonSchema = this.zodToBasicJsonSchema(tool.zodSchema)
      schema = jsonSchema
    } else {
      // Already a plain object schema — passthrough
      schema = tool.zodSchema as object
    }

    this.jsonSchemaCache.set(tool.name, schema)
    return schema
  }

  private zodToBasicJsonSchema(zodSchema: z.ZodType): object {
    try {
      const result = zodToJsonSchema(zodSchema, { target: 'openApi3' })
      const { $schema, ...rest } = result as Record<string, unknown>
      return rest
    } catch (err) {
      console.warn(`zodToJsonSchema failed:`, err instanceof Error ? err.message : err)
      return { type: 'object', properties: {} }
    }
  }
}
