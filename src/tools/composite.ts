import { z } from 'zod'
import type { ToolRegistry } from '../registry.js'
import type { AuthAdapter } from '../auth-adapter.js'

export function registerCompositeTools(registry: ToolRegistry) {
  registry.register({
    name: 'create_contract',
    description:
      'Create a new contract linking a buyer to an offer. Defines pricing, filters, caps, delivery, and call settings. If offerId is provided, automatically links the contract to the offer. Requires confirmation.',
    zodSchema: z.object({
      name: z.string().describe('Contract name, e.g. "Acme Motors - Auto Insurance" or "USHA - Health Exclusive". Use format: "{buyerName} - {description}"'),
      buyerId: z
        .string()
        .describe('Buyer UUID (from list_buyers — never a name or slug)'),
      verticalId: z
        .string()
        .describe('Vertical UUID (from search — never a slug or name)'),
      offerId: z
        .string()
        .optional()
        .describe('Offer UUID to link this contract to'),
      status: z
        .enum(['active', 'paused', 'inactive'])
        .optional()
        .describe('Contract status (default: active)'),
      pricingModel: z
        .enum(['fixed', 'ping_post'])
        .optional()
        .default('fixed')
        .describe('Pricing model: "fixed" for set price, "ping_post" for real-time auction bidding'),
      pricePerLead: z
        .coerce.number()
        .optional()
        .describe('Price per lead in dollars. For ping_post, this is the minimum bid floor.'),
      exclusiveMultiplier: z
        .coerce.number()
        .optional()
        .describe('Multiplier for exclusive leads (default: 1)'),
      priority: z
        .coerce.number()
        .optional()
        .describe('Priority rank (lower = higher priority, default: 10)'),
      dailyLeadCap: z
        .coerce.number()
        .nullable()
        .optional()
        .describe('Max leads per day (null = unlimited)'),
      weeklyLeadCap: z
        .coerce.number()
        .nullable()
        .optional()
        .describe('Max leads per week'),
      monthlyLeadCap: z
        .coerce.number()
        .nullable()
        .optional()
        .describe('Max leads per month'),
      dailySpendCap: z
        .coerce.number()
        .nullable()
        .optional()
        .describe('Max spend per day'),
      geoFilters: z
        .record(z.unknown())
        .optional()
        .describe(
          'Geographic filters (e.g. { states: ["CA","NY"], zipcodes: ["90210"] })'
        ),
      demographicFilters: z
        .record(z.unknown())
        .optional()
        .describe('Demographic filters (e.g. { minAge: 25, maxAge: 65 })'),
      customFilters: z
        .record(z.unknown())
        .optional()
        .describe('Custom field filters matching vertical field names'),
      scheduleTimezone: z
        .string()
        .optional()
        .describe('Timezone for schedule (e.g. America/New_York)'),
      scheduleHours: z
        .record(z.unknown())
        .optional()
        .describe(
          'Operating hours per day (e.g. { mon: { start: "09:00", end: "17:00" } })'
        ),
      deliveryUrlOverride: z
        .string()
        .optional()
        .describe('Delivery endpoint URL for this contract (where leads get sent)'),
      deliveryConfig: z
        .array(z.object({
          id: z.string().describe('Unique action ID (e.g. "ping-1")'),
          type: z.enum(['http_post', 'http_get', 'email', 'ftp']).describe('Delivery type'),
          enabled: z.boolean().optional().default(true),
          isPrimary: z.boolean().optional().default(false),
          url: z.string().optional().describe('Endpoint URL'),
          format: z.enum(['json', 'xml', 'form']).optional().default('json'),
          timeout: z.number().optional().describe('Request timeout in seconds'),
          authType: z.enum(['none', 'basic', 'bearer', 'api_key']).optional().default('none'),
          authCredentials: z.object({
            username: z.string().optional(),
            password: z.string().optional(),
            token: z.string().optional(),
            headerName: z.string().optional(),
          }).optional(),
          responseFieldMapping: z.array(z.object({
            responsePath: z.string(),
            mapsTo: z.enum(['buyerLeadId', 'bidPrice', 'responseMessage', 'redirectUrl', 'adjustedPrice', 'pingToken', 'brand', 'responseStatus', 'responseReason']),
          })).optional().describe('How to extract bidPrice, pingToken etc. from buyer response'),
        }))
        .optional()
        .describe('For ping_post: delivery actions array with HTTP config for pinging the buyer endpoint'),
      requiresPing: z
        .preprocess((v) => v === 'true' || v === true, z.boolean())
        .optional()
        .describe('Set to true for ping_post contracts'),
      pingTimeout: z
        .coerce.number()
        .optional()
        .describe('Milliseconds to wait for buyer bid response (default 5000)'),
      callEnabled: z
        .preprocess((v) => v === 'true' || v === true, z.boolean())
        .optional()
        .describe('Enable call routing for this contract'),
      callConnectPrice: z
        .coerce.number()
        .optional()
        .describe('Price per connected call'),
      callMinDuration: z
        .coerce.number()
        .optional()
        .describe(
          'Min call duration in seconds to count as connected'
        ),
    }),
    handler: async (args: Record<string, unknown>, auth: AuthAdapter) => {
      const { offerId, pricePerLead, pricingModel, price: rawPrice, requiresPing, pingTimeout, ...rest } = args
      // Map composite tool fields to API schema fields
      // Accept both 'pricePerLead' (composite schema) and 'price' (API schema) for resilience
      // Coerce to number — agents sometimes pass strings through JSON round-trips
      const resolvedPrice = Number(pricePerLead ?? rawPrice ?? 0)
      const resolvedPricingModel = pricingModel ?? 'fixed'
      const contractBody: Record<string, unknown> = {
        ...rest,
        // API expects 'price' (number) — coerce from string if needed
        price: isNaN(resolvedPrice) ? 0 : resolvedPrice,
        pricingModel: resolvedPricingModel,
      }
      // Coerce numeric fields that agents sometimes send as strings
      if (typeof contractBody.priority === 'string') contractBody.priority = Number(contractBody.priority) || 0
      if (typeof contractBody.dailyLeadCap === 'string') contractBody.dailyLeadCap = Number(contractBody.dailyLeadCap) || null
      if (typeof contractBody.weeklyLeadCap === 'string') contractBody.weeklyLeadCap = Number(contractBody.weeklyLeadCap) || null
      if (typeof contractBody.monthlyLeadCap === 'string') contractBody.monthlyLeadCap = Number(contractBody.monthlyLeadCap) || null
      // Ensure name is always a string
      if (!contractBody.name && contractBody.buyerId) {
        contractBody.name = `Contract for ${contractBody.buyerId}`
      }
      // For ping_post contracts, set requiresPing and pingTimeout
      if (resolvedPricingModel === 'ping_post') {
        contractBody.requiresPing = requiresPing === true || requiresPing === 'true' ? true : (requiresPing === false || requiresPing === 'false' ? false : true)
        contractBody.pingTimeout = Number(pingTimeout) || 5000
      }
      // Coerce boolean fields that agents sometimes send as strings
      if (typeof contractBody.requiresPing === 'string') contractBody.requiresPing = contractBody.requiresPing === 'true'
      if (typeof contractBody.acceptsReturns === 'string') contractBody.acceptsReturns = contractBody.acceptsReturns === 'true'
      if (typeof contractBody.allowMultiSale === 'string') contractBody.allowMultiSale = contractBody.allowMultiSale === 'true'
      if (typeof contractBody.callEnabled === 'string') contractBody.callEnabled = contractBody.callEnabled === 'true'
      // Coerce deliveryConfig — ensure array items have boolean fields as actual booleans
      if (Array.isArray(contractBody.deliveryConfig)) {
        contractBody.deliveryConfig = (contractBody.deliveryConfig as Array<Record<string, unknown>>).map(item => ({
          ...item,
          enabled: item.enabled === 'true' || item.enabled === true ? true : (item.enabled === 'false' || item.enabled === false ? false : true),
          isPrimary: item.isPrimary === 'true' || item.isPrimary === true,
        }))
      } else if (typeof contractBody.deliveryConfig === 'string') {
        try { contractBody.deliveryConfig = JSON.parse(contractBody.deliveryConfig as string) } catch { /* leave as is */ }
      }
      // Create the contract first
      const contractResult = (await auth.fetch('/api/v1/contracts', {
        method: 'POST',
        body: contractBody,
      })) as any
      // If an offerId was provided and contract created successfully, link it
      if (offerId && contractResult?.data?.id) {
        await auth.fetch(`/api/v1/offers/${offerId}/contracts`, {
          method: 'POST',
          body: { contractId: contractResult.data.id },
        })
      }
      return contractResult
    },
    metadata: {
      domain: 'contracts',
      entity: 'contract',
      isWrite: true,
      confirmRequired: true,
      method: 'POST',
      path: '/api/v1/contracts',
      tags: ['contracts', 'composite'],
      summary:
        'Create contract and optionally link to offer',
      allowedRoles: ['admin', 'superadmin'],
    } as any,
  })

  registry.register({
    name: 'setup_partner_onboarding',
    description:
      'Guided onboarding: creates an offer, campaign, and contract in sequence to set up a partner-to-buyer lead flow. Provide the partner, buyer, vertical, and pricing details. Creates all three entities and returns the posting spec. Requires confirmation.',
    zodSchema: z.object({
      offerName: z.string().describe('Name for the new offer'),
      verticalId: z
        .string()
        .describe('Vertical UUID (from search — never a slug or name)'),
      partnerId: z
        .string()
        .describe('Partner UUID (from list_partners — never a name or slug)'),
      campaignName: z.string().describe('Name for the campaign'),
      buyerId: z
        .string()
        .describe('Buyer UUID (from list_buyers — never a name or slug)'),
      contractName: z.string().describe('Name for the contract'),
      pricePerLead: z.number().describe('Price buyer pays per lead'),
      campaignCost: z
        .number()
        .optional()
        .describe('Cost per lead paid to partner'),
      distributionType: z
        .enum(['exclusive', 'multisell', 'hybrid'])
        .optional()
        .describe('Distribution type (default: exclusive)'),
      dailyLeadCap: z
        .number()
        .nullable()
        .optional()
        .describe('Daily cap for the contract'),
    }),
    handler: async (args: Record<string, unknown>, auth: AuthAdapter) => {
      // Step 1: Create offer
      const offerResult = (await auth.fetch('/api/v1/offers', {
        method: 'POST',
        body: {
          name: args.offerName,
          verticalId: args.verticalId,
          status: 'active',
          distributionType: args.distributionType || 'exclusive',
          distributionRule: 'priority',
        },
      })) as any
      if (offerResult?.error)
        return {
          error: true,
          message: `Failed to create offer: ${offerResult.message}`,
        }
      const offerId = offerResult.data?.id
      if (!offerId)
        return { error: true, message: 'Offer created but no ID returned' }

      // Step 2: Create campaign
      const campaignResult = (await auth.fetch('/api/v1/campaigns', {
        method: 'POST',
        body: {
          name: args.campaignName,
          offerId,
          partnerId: args.partnerId,
          status: 'active',
          cost: args.campaignCost || 0,
          costModel: 'per_lead',
        },
      })) as any
      if (campaignResult?.error)
        return {
          error: true,
          message: `Offer created but campaign failed: ${campaignResult.message}`,
          offerId,
        }
      const campaignId = campaignResult.data?.id

      // Step 3: Create contract
      const contractResult = (await auth.fetch('/api/v1/contracts', {
        method: 'POST',
        body: {
          name: args.contractName,
          buyerId: args.buyerId,
          verticalId: args.verticalId,
          status: 'active',
          pricingModel: 'per_lead',
          pricePerLead: args.pricePerLead,
          priority: 1,
          dailyLeadCap: args.dailyLeadCap || null,
        },
      })) as any
      if (contractResult?.error)
        return {
          error: true,
          message: `Offer + campaign created but contract failed: ${contractResult.message}`,
          offerId,
          campaignId,
        }
      const contractId = contractResult.data?.id

      // Step 4: Link contract to offer
      if (contractId) {
        await auth.fetch(`/api/v1/offers/${offerId}/contracts`, {
          method: 'POST',
          body: { contractId },
        })
      }

      // Step 5: Get posting spec
      let postingSpec = null
      if (campaignId) {
        const specResult = (await auth.fetch(
          `/api/public/campaigns/${campaignId}/specs`
        )) as any
        if (!specResult?.error) postingSpec = specResult
      }

      return {
        data: {
          offerId,
          campaignId,
          contractId,
          postingKey: campaignResult.data?.postingKey || null,
          postingSpec,
          summary: `Created offer "${args.offerName}", campaign "${args.campaignName}", and contract "${args.contractName}". Partner can now submit leads using the posting key.`,
        },
      }
    },
    metadata: {
      domain: 'onboarding',
      entity: 'partner',
      isWrite: true,
      confirmRequired: true,
      method: 'POST',
      path: '/api/v1/offers',
      tags: ['onboarding', 'composite'],
      summary:
        'Full partner onboarding: create offer + campaign + contract + link + posting spec',
      allowedRoles: ['admin', 'superadmin'],
    } as any,
  })
}
