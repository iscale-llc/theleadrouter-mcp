#!/usr/bin/env tsx
/**
 * OpenAPI → MCP Tool Generator
 *
 * Parses openapi-full.yaml and generates:
 *   - src/tools/generated/<domain>.gen.ts  (one per tag domain)
 *   - src/tools/generated/catalog.json     (flat metadata for context router)
 *   - src/tools/generated/index.ts         (barrel re-export)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yaml from 'js-yaml'

// ─── Paths ────────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const MCP_SRC = path.join(ROOT, 'src')
const OUT_DIR = path.join(MCP_SRC, 'tools', 'generated')
const SPEC_PATH = path.resolve(ROOT, '..', '..', 'apps', 'routing', 'public', 'openapi-full.yaml')

// ─── Types ────────────────────────────────────────────────────────────────────
type OpenAPISpec = {
  info: { version: string }
  paths: Record<string, Record<string, any>>
  components?: { parameters?: Record<string, any>; schemas?: Record<string, any> }
}

type ToolEntry = {
  name: string
  description: string
  zodLines: string
  handlerCode: string
  metadata: {
    domain: string
    entity: string
    isWrite: boolean
    confirmRequired: boolean
    method: string
    path: string
    tags: string[]
    summary: string
    allowedRoles: string[]
    annotations?: { readOnly?: boolean; destructive?: boolean }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/__+/g, '_')
}

function simplifyTag(tag: string): string {
  return tag
    .replace(/^(Admin|Buyer|Partner|Superadmin|Portal|Public|V1|System):\s*/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function extractEntity(operationId: string): string {
  // list_buyers → buyer, get_buyer_balance → buyer, create_contract → contract
  const snake = toSnakeCase(operationId)
  const parts = snake.split('_')
  // skip verb (list, get, create, update, delete, etc.)
  const verbs = new Set(['list', 'get', 'create', 'update', 'delete', 'search', 'bulk', 'export', 'import', 'submit', 'set', 'add', 'remove', 'toggle', 'patch', 'put', 'post', 'fetch', 'check', 'validate', 'send', 'test', 'request', 'approve', 'reject', 'process', 'cancel', 'pause', 'resume', 'activate', 'deactivate', 'revoke', 'reset', 'forgot', 'merge', 'transfer', 'assign', 'populate', 'release', 'exit', 'backfill', 'cascade', 'adjust', 'cherry', 'distribute', 'scrub', 'return', 'impersonate', 'login', 'logout'])
  let entityParts: string[] = []
  let foundVerb = false
  for (const p of parts) {
    if (!foundVerb && verbs.has(p)) {
      foundVerb = true
      continue
    }
    entityParts.push(p)
  }
  if (entityParts.length === 0) entityParts = parts.slice(0, 1)
  // singularize: buyers → buyer, contracts → contract
  let entity = entityParts[0]
  if (entity.endsWith('ies')) entity = entity.slice(0, -3) + 'y'
  else if (entity.endsWith('ses')) entity = entity.slice(0, -2)
  else if (entity.endsWith('s') && !entity.endsWith('ss') && !entity.endsWith('us') && !entity.endsWith('is')) entity = entity.slice(0, -1)
  return entity
}

function deriveAllowedRoles(apiPath: string): string[] {
  if (apiPath.startsWith('/api/superadmin/')) return ['superadmin']
  if (apiPath.startsWith('/api/admin/')) return ['admin', 'superadmin']
  if (apiPath.startsWith('/api/buyer/')) return ['buyer', 'admin', 'superadmin']
  if (apiPath.startsWith('/api/partner/')) return ['partner', 'admin', 'superadmin']
  if (apiPath.startsWith('/api/public/')) return ['admin', 'buyer', 'partner', 'superadmin']
  // /api/v1/ routes: accessible via session (admin) or API key (buyer/partner)
  // The API layer enforces role-based filtering — safe to allow all roles here
  if (apiPath.startsWith('/api/v1/')) return ['admin', 'buyer', 'partner', 'superadmin']
  return ['admin', 'superadmin']
}

function resolveRef(spec: OpenAPISpec, ref: string): any {
  // $ref: "#/components/parameters/limit" → spec.components.parameters.limit
  const parts = ref.replace('#/', '').split('/')
  let obj: any = spec
  for (const p of parts) obj = obj?.[p]
  return obj
}

// ─── OpenAPI → Zod string ────────────────────────────────────────────────────

/** Cache of resolved component schemas to avoid infinite recursion */
let _spec: OpenAPISpec | null = null

function setSpecForResolver(spec: OpenAPISpec) { _spec = spec }

function resolveSchemaRef(ref: string): any {
  if (!_spec) return null
  const parts = ref.replace('#/', '').split('/')
  let obj: any = _spec
  for (const p of parts) obj = obj?.[p]
  return obj
}

/**
 * Convert an OpenAPI schema to a Zod code string.
 * Resolves $ref, nested objects, typed arrays, and oneOf/anyOf/allOf.
 * Max depth prevents infinite recursion on circular refs.
 */
function openApiTypeToZod(prop: any, required: boolean, depth = 0): string {
  if (!prop) return 'z.unknown()'

  // Prevent infinite recursion on circular schemas
  if (depth > 4) return 'z.record(z.unknown())'

  // Resolve $ref — follow the pointer and convert the resolved schema
  if (prop.$ref) {
    const resolved = resolveSchemaRef(prop.$ref)
    if (resolved) {
      const inner = openApiTypeToZod(resolved, true, depth + 1)
      // Apply nullable/optional from the referencing site (not the resolved schema)
      let zodStr = inner
      if (prop.nullable) zodStr += '.nullable()'
      if (!required) zodStr += '.optional()'
      return zodStr
    }
    // Fallback if ref can't be resolved
    return `z.record(z.unknown())${!required ? '.optional()' : ''}`
  }

  // oneOf / anyOf — use z.union if we can resolve variants, else first variant
  if (prop.oneOf || prop.anyOf) {
    const variants = prop.oneOf || prop.anyOf
    if (Array.isArray(variants) && variants.length > 0) {
      if (variants.length === 1) {
        return openApiTypeToZod(variants[0], required, depth + 1)
      }
      const zodVariants = variants.map((v: any) => openApiTypeToZod(v, true, depth + 1))
      let zodStr = `z.union([${zodVariants.join(', ')}])`
      if (prop.nullable) zodStr += '.nullable()'
      if (!required) zodStr += '.optional()'
      return zodStr
    }
  }

  // allOf — merge properties from all sub-schemas into a single z.object
  if (prop.allOf && Array.isArray(prop.allOf)) {
    const mergedProps: Record<string, any> = {}
    const mergedRequired = new Set<string>()
    for (const sub of prop.allOf) {
      const resolved = sub.$ref ? resolveSchemaRef(sub.$ref) : sub
      if (!resolved) continue
      if (resolved.properties) Object.assign(mergedProps, resolved.properties)
      if (resolved.required) resolved.required.forEach((r: string) => mergedRequired.add(r))
    }
    if (Object.keys(mergedProps).length > 0) {
      return openApiTypeToZod(
        { type: 'object', properties: mergedProps, required: [...mergedRequired] },
        required,
        depth + 1,
      )
    }
    return `z.record(z.unknown())${!required ? '.optional()' : ''}`
  }

  let zodStr: string

  switch (prop.type) {
    case 'string':
      if (prop.enum && Array.isArray(prop.enum)) {
        zodStr = `z.enum([${prop.enum.map((v: string) => `'${v}'`).join(', ')}])`
      } else {
        zodStr = 'z.string()'
      }
      break
    case 'integer':
      zodStr = 'z.number().int()'
      break
    case 'number':
      zodStr = 'z.number()'
      break
    case 'boolean':
      zodStr = 'z.boolean()'
      break
    case 'array':
      if (prop.items) {
        const itemZod = openApiTypeToZod(prop.items, true, depth + 1)
        zodStr = `z.array(${itemZod})`
      } else {
        zodStr = 'z.array(z.unknown())'
      }
      break
    case 'object':
      if (prop.properties && Object.keys(prop.properties).length > 0) {
        // Inline object with known properties → z.object({...})
        const reqSet = new Set<string>(prop.required || [])
        const fields = Object.entries<any>(prop.properties).map(([name, schema]) => {
          const fieldZod = openApiTypeToZod(schema, reqSet.has(name), depth + 1)
          return `${name}: ${fieldZod}`
        })
        zodStr = `z.object({ ${fields.join(', ')} })`
      } else if (prop.additionalProperties && typeof prop.additionalProperties === 'object') {
        // Typed record: additionalProperties with a schema
        const valZod = openApiTypeToZod(prop.additionalProperties, true, depth + 1)
        zodStr = `z.record(${valZod})`
      } else {
        // Plain object with no schema — use z.record(z.string(), z.unknown())
        zodStr = 'z.record(z.unknown())'
      }
      break
    default:
      zodStr = 'z.unknown()'
  }

  if (prop.nullable) zodStr += '.nullable()'
  if (!required) zodStr += '.optional()'
  if (prop.description) {
    const desc = prop.description.replace(/'/g, "\\'").replace(/\n/g, ' ').slice(0, 200)
    zodStr += `.describe('${desc}')`
  }

  return zodStr
}

// ─── Parameter extraction ─────────────────────────────────────────────────────

type ParamInfo = {
  name: string
  in: 'path' | 'query' | 'header'
  required: boolean
  schema: any
  description?: string
}

function extractParameters(spec: OpenAPISpec, pathItem: any, operation: any): ParamInfo[] {
  const params: ParamInfo[] = []
  const seen = new Set<string>()

  const rawParams = [...(pathItem.parameters || []), ...(operation.parameters || [])]
  for (const p of rawParams) {
    const resolved = p.$ref ? resolveRef(spec, p.$ref) : p
    if (!resolved || seen.has(resolved.name)) continue
    seen.add(resolved.name)
    params.push({
      name: resolved.name,
      in: resolved.in,
      required: resolved.required ?? false,
      schema: resolved.schema || { type: 'string' },
      description: resolved.description,
    })
  }

  return params
}

// ─── Request body extraction ──────────────────────────────────────────────────

type BodyProp = {
  name: string
  schema: any
  required: boolean
  description?: string
}

function extractRequestBody(operation: any): BodyProp[] {
  const rb = operation.requestBody
  if (!rb) return []
  const content = rb.content?.['application/json']
  if (!content?.schema) return []
  const schema = content.schema
  if (schema.type !== 'object' || !schema.properties) return []
  const requiredSet = new Set<string>(schema.required || [])
  const props: BodyProp[] = []
  for (const [name, prop] of Object.entries<any>(schema.properties)) {
    props.push({
      name,
      schema: prop,
      required: requiredSet.has(name),
      description: prop.description,
    })
  }
  return props
}

// ─── Build a single tool entry ────────────────────────────────────────────────

function buildToolEntry(
  spec: OpenAPISpec,
  apiPath: string,
  method: string,
  pathItem: any,
  operation: any,
): ToolEntry | null {
  const operationId = operation.operationId
  if (!operationId) return null

  const toolName = toSnakeCase(operationId)
  const httpMethod = method.toUpperCase()

  // Skip auth endpoints — agent should never call these
  const SKIP_OPERATIONS = ['login', 'logout', 'forgot_password', 'reset_password', 'verify_email']
  if (SKIP_OPERATIONS.includes(toolName)) return null

  // POST endpoints that are actually reads (searches)
  const POST_BUT_READ = toolName.includes('search') || toolName.includes('query') || toolName.includes('export')
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(httpMethod) && !POST_BUT_READ

  const tags = (operation.tags || ['Unknown']).map(simplifyTag)
  const domain = tags[0] || 'unknown'
  const entity = extractEntity(operationId)
  const summary = operation.summary || operation.description?.slice(0, 100) || ''
  // Build a richer description — short summaries make Claude guess wrong
  let description = summary
  if (operation.description && operation.description !== summary) {
    description += '\n\n' + operation.description.slice(0, 300)
  }

  const params = extractParameters(spec, pathItem, operation)
  const bodyProps = extractRequestBody(operation)

  const pathParams = params.filter(p => p.in === 'path')
  const queryParams = params.filter(p => p.in === 'query')

  // Enrich short descriptions
  if (description.length < 20) {
    const verb: Record<string, string> = { GET: 'Retrieve', POST: 'Create', PUT: 'Replace', PATCH: 'Update', DELETE: 'Delete' }
    description = `${verb[httpMethod] || httpMethod} ${entity || domain}. ${description}`.trim()
    if (pathParams.length > 0) description += ` Requires: ${pathParams.map(p => p.name).join(', ')}.`
  }

  // Build Zod schema lines
  const zodFields: string[] = []

  for (const p of pathParams) {
    zodFields.push(`    ${p.name}: z.string()${p.description ? `.describe('${p.description.replace(/'/g, "\\'").slice(0, 200)}')` : ''},`)
  }
  for (const p of queryParams) {
    zodFields.push(`    ${p.name}: ${openApiTypeToZod(p.schema, p.required)},`)
  }
  for (const bp of bodyProps) {
    zodFields.push(`    ${bp.name}: ${openApiTypeToZod(bp.schema, bp.required)},`)
  }

  const zodLines = zodFields.length > 0
    ? `z.object({\n${zodFields.join('\n')}\n  })`
    : 'z.object({})'

  // Build handler code
  const pathParamNames = pathParams.map(p => p.name)
  const queryParamNames = queryParams.map(p => p.name)
  const bodyPropNames = bodyProps.map(p => p.name)

  let handlerLines: string[] = []
  handlerLines.push(`async (args: Record<string, unknown>, auth: AuthAdapter) => {`)

  // Resolve path params (validate they exist)
  if (pathParamNames.length > 0) {
    handlerLines.push(`      let resolvedPath = '${apiPath}'`)
    for (const pn of pathParamNames) {
      handlerLines.push(`      if (!args.${pn}) return { error: true, message: 'Missing required parameter: ${pn}' }`)
      handlerLines.push(`      resolvedPath = resolvedPath.replace('{${pn}}', encodeURIComponent(String(args.${pn})))`)
    }
  } else {
    handlerLines.push(`      const resolvedPath = '${apiPath}'`)
  }

  // Query params
  if (queryParamNames.length > 0) {
    handlerLines.push(`      const params: Record<string, string> = {}`)
    for (const qn of queryParamNames) {
      handlerLines.push(`      if (args.${qn} !== undefined) params.${qn} = String(args.${qn})`)
    }
  }

  // Body
  if (isWrite && bodyPropNames.length > 0) {
    const destructure = [...pathParamNames, ...queryParamNames].map(n => `${n}: _${n}`).join(', ')
    if (destructure) {
      handlerLines.push(`      const { ${destructure}, ...body } = args`)
    } else {
      handlerLines.push(`      const body = args`)
    }
  }

  // Return statement
  const fetchOpts: string[] = []
  if (httpMethod !== 'GET') fetchOpts.push(`method: '${httpMethod}'`)
  if (queryParamNames.length > 0) fetchOpts.push('params')
  if (isWrite && bodyPropNames.length > 0) fetchOpts.push('body')

  if (fetchOpts.length > 0) {
    handlerLines.push(`      return auth.fetch(resolvedPath, { ${fetchOpts.join(', ')} })`)
  } else {
    handlerLines.push(`      return auth.fetch(resolvedPath)`)
  }

  handlerLines.push(`    }`)

  return {
    name: toolName,
    description: description.replace(/`/g, "'").slice(0, 500),
    zodLines,
    handlerCode: handlerLines.join('\n'),
    metadata: {
      domain,
      entity,
      isWrite,
      confirmRequired: isWrite && !apiPath.includes('/ping'),
      method: httpMethod,
      path: apiPath,
      tags,
      summary: summary.replace(/`/g, "'").slice(0, 200),
      allowedRoles: deriveAllowedRoles(apiPath),
      annotations: {
        readOnly: !isWrite || undefined,
        destructive: httpMethod === 'DELETE' || undefined,
      },
    },
  }
}

// ─── File generation ──────────────────────────────────────────────────────────

function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
}

function generateDomainFile(domain: string, tools: ToolEntry[]): string {
  const funcName = `register${toPascalCase(domain)}Tools`
  const lines: string[] = [
    `// Auto-generated by scripts/generate-tools.ts — DO NOT EDIT`,
    `import { z } from 'zod'`,
    `import type { ToolRegistry } from '../../registry.js'`,
    `import type { AuthAdapter } from '../../auth-adapter.js'`,
    ``,
    `export function ${funcName}(registry: ToolRegistry) {`,
  ]

  for (const tool of tools) {
    const metaStr = JSON.stringify(tool.metadata, (_, v) => v === undefined ? undefined : v, 0)
      .replace(/"([^"]+)":/g, '$1:') // unquote keys

    lines.push(`  registry.register({`)
    lines.push(`    name: ${JSON.stringify(tool.name)},`)
    lines.push(`    description: \`${tool.description.replace(/\\/g, '\\\\').replace(/`/g, "'")}\`,`)
    lines.push(`    zodSchema: ${tool.zodLines},`)
    lines.push(`    handler: ${tool.handlerCode},`)
    lines.push(`    metadata: ${metaStr},`)
    lines.push(`  })`)
    lines.push(``)
  }

  lines.push(`}`)
  return lines.join('\n')
}

function generateBarrel(domains: Map<string, ToolEntry[]>): string {
  const lines: string[] = [
    `// Auto-generated by scripts/generate-tools.ts — DO NOT EDIT`,
    `import type { ToolRegistry } from '../../registry.js'`,
    ``,
  ]

  const funcNames: string[] = []
  for (const [domain] of domains) {
    const funcName = `register${toPascalCase(domain)}Tools`
    funcNames.push(funcName)
    lines.push(`import { ${funcName} } from './${domain}.gen.js'`)
  }

  lines.push(``)
  lines.push(`export function registerAllGeneratedTools(registry: ToolRegistry) {`)
  for (const fn of funcNames) {
    lines.push(`  ${fn}(registry)`)
  }
  lines.push(`}`)
  lines.push(``)
  lines.push(`// Note: catalog.json is available at packages/mcp/src/tools/generated/catalog.json`)
  lines.push(`// Use registry.getCatalog() at runtime instead of importing the JSON directly`)
  lines.push(`// (import.meta.url + createRequire breaks in webpack/Vercel bundled environments)`)

  return lines.join('\n')
}

function generateCatalog(allTools: ToolEntry[], specVersion: string): object {
  return {
    generatedAt: new Date().toISOString(),
    specVersion,
    toolCount: allTools.length,
    tools: allTools.map(t => ({
      name: t.name,
      ...t.metadata,
    })),
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`Reading OpenAPI spec from ${SPEC_PATH}`)
  const raw = fs.readFileSync(SPEC_PATH, 'utf-8')
  const spec = yaml.load(raw) as OpenAPISpec
  setSpecForResolver(spec)

  if (!spec.paths) {
    console.error('No paths found in spec')
    process.exit(1)
  }

  const allTools: ToolEntry[] = []
  const warnings: string[] = []
  const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete']

  for (const [apiPath, pathItem] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method]
      if (!operation) continue

      // Skip cron/webhook/health/internal endpoints
      if (apiPath.includes('/cron/') || apiPath.includes('/webhook') || apiPath.includes('/health') || apiPath.includes('/sentry/')) continue

      try {
        const entry = buildToolEntry(spec, apiPath, method, pathItem, operation)
        if (entry) {
          // Deduplicate by name
          if (allTools.some(t => t.name === entry.name)) {
            warnings.push(`Duplicate operationId: ${entry.name} at ${method.toUpperCase()} ${apiPath} — skipping`)
            continue
          }
          allTools.push(entry)
        } else {
          warnings.push(`No operationId for ${method.toUpperCase()} ${apiPath} — skipping`)
        }
      } catch (err: any) {
        warnings.push(`Error processing ${method.toUpperCase()} ${apiPath}: ${err.message}`)
      }
    }
  }

  // Group by domain
  const domains = new Map<string, ToolEntry[]>()
  for (const tool of allTools) {
    const d = tool.metadata.domain
    if (!domains.has(d)) domains.set(d, [])
    domains.get(d)!.push(tool)
  }

  // Ensure output dir
  fs.mkdirSync(OUT_DIR, { recursive: true })

  // Clean old generated files
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.gen.ts') || f === 'catalog.json' || f === 'index.ts') {
      fs.unlinkSync(path.join(OUT_DIR, f))
    }
  }

  // Write domain files
  let fileCount = 0
  for (const [domain, tools] of domains) {
    const filePath = path.join(OUT_DIR, `${domain}.gen.ts`)
    fs.writeFileSync(filePath, generateDomainFile(domain, tools))
    fileCount++
    console.log(`  ${domain}.gen.ts — ${tools.length} tools`)
  }

  // Write catalog.json
  const catalog = generateCatalog(allTools, spec.info?.version || 'unknown')
  fs.writeFileSync(path.join(OUT_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2))
  fileCount++

  // Write barrel
  fs.writeFileSync(path.join(OUT_DIR, 'index.ts'), generateBarrel(domains))
  fileCount++

  // Summary
  console.log(`\n--- Summary ---`)
  console.log(`Tools generated: ${allTools.length}`)
  console.log(`Files created: ${fileCount}`)
  console.log(`Domains: ${[...domains.keys()].join(', ')}`)

  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`)
    for (const w of warnings) console.log(`  ⚠ ${w}`)
  }

  console.log(`\nDone.`)
}

main()
