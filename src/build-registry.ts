import { ToolRegistry } from './registry.js'
import { registerUiTools } from './tools/ui.js'
import { registerCompositeTools } from './tools/composite.js'
import { registerAllGeneratedTools } from './tools/generated/index.js'

export function buildRegistry(): ToolRegistry {
  const registry = new ToolRegistry()

  // 1. Hand-written overrides first (take priority — registry skips duplicates)
  registerCompositeTools(registry)

  // 2. Generated tools (skipped if name already registered)
  registerAllGeneratedTools(registry)

  // 3. UI tools (no API equivalent, always registered)
  registerUiTools(registry)

  return registry
}
