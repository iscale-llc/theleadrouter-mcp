import { z } from 'zod'
import type { ToolRegistry } from '../registry.js'

export function registerUiTools(registry: ToolRegistry) {
  registry.register({
    name: 'navigate_to',
    description:
      'Navigate the admin UI to a specific page. Use this when the user asks to go to or view a specific entity.',
    zodSchema: z.object({
      path: z
        .string()
        .describe(
          'Path to navigate to, e.g. /admin/offers, /admin/offers/:id, /admin/campaigns/:id'
        ),
    }),
    handler: async (args: Record<string, unknown>) => {
      const path = String(args.path || '')
      if (!path.startsWith('/') || path.includes('://')) {
        return { error: true, message: `Invalid navigation path: ${path}` }
      }
      return { action: 'navigate', path }
    },
    metadata: {
      domain: 'ui',
      isWrite: false,
      confirmRequired: false,
      method: 'INLINE',
      path: '',
      tags: ['ui'],
      summary: 'Navigate the admin UI to a specific page',
      allowedRoles: ['admin', 'buyer', 'partner', 'superadmin'],
    } as any,
  })

  registry.register({
    name: 'highlight_element',
    description:
      'Highlight a specific UI element with a spotlight overlay. Use CSS selector or data-field attribute.',
    zodSchema: z.object({
      selector: z
        .string()
        .describe('CSS selector or data-field attribute to highlight'),
      label: z
        .string()
        .optional()
        .describe('Optional label to show near the highlighted element'),
      description: z
        .string()
        .optional()
        .describe('Optional description to show near the highlighted element'),
    }),
    handler: async (args: Record<string, unknown>) => {
      return {
        action: 'highlight',
        selector: String(args.selector),
        label: args.label ? String(args.label) : undefined,
        description: args.description ? String(args.description) : undefined,
      }
    },
    metadata: {
      domain: 'ui',
      isWrite: false,
      confirmRequired: false,
      method: 'INLINE',
      path: '',
      tags: ['ui'],
      summary: 'Highlight a UI element with spotlight overlay',
      allowedRoles: ['admin', 'buyer', 'partner', 'superadmin'],
    } as any,
  })

  registry.register({
    name: 'start_walkthrough',
    description:
      'Run a multi-step guided tour highlighting elements with explanations.',
    zodSchema: z.object({
      title: z.string().describe('Title of the walkthrough'),
      steps: z
        .array(
          z.object({
            selector: z
              .string()
              .describe('CSS selector for the element to highlight'),
            title: z.string().describe('Step title'),
            description: z.string().describe('Step description'),
            action: z
              .string()
              .optional()
              .describe('Optional action hint (e.g. "click", "type")'),
          })
        )
        .describe('Array of steps in the walkthrough'),
    }),
    handler: async (args: Record<string, unknown>) => {
      const steps = args.steps as Array<{
        selector: string
        title: string
        description: string
        action?: string
      }>
      return {
        action: 'walkthrough',
        title: String(args.title),
        steps: steps.map((s) => ({
          selector: s.selector,
          title: s.title,
          description: s.description,
          action: s.action || undefined,
        })),
      }
    },
    metadata: {
      domain: 'ui',
      isWrite: false,
      confirmRequired: false,
      method: 'INLINE',
      path: '',
      tags: ['ui'],
      summary: 'Run a multi-step guided tour',
      allowedRoles: ['admin', 'buyer', 'partner', 'superadmin'],
    } as any,
  })
}
