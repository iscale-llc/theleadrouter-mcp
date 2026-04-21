import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ApiClient } from './api-client.js'
import { registerLeadTools } from './tools/leads.js'
import { registerBuyerTools } from './tools/buyers.js'
import { registerPartnerTools } from './tools/partners.js'
import { registerContractTools } from './tools/contracts.js'
import { registerCampaignTools } from './tools/campaigns.js'
import { registerOfferTools } from './tools/offers.js'
import { registerReportTools } from './tools/reports.js'
import { registerPeopleTools } from './tools/people.js'
import { registerComplianceTools } from './tools/compliance.js'
import { registerVerticalTools } from './tools/verticals.js'

export function registerAllTools(server: McpServer, api: ApiClient) {
  registerLeadTools(server, api)
  registerBuyerTools(server, api)
  registerPartnerTools(server, api)
  registerContractTools(server, api)
  registerCampaignTools(server, api)
  registerOfferTools(server, api)
  registerReportTools(server, api)
  registerPeopleTools(server, api)
  registerComplianceTools(server, api)
  registerVerticalTools(server, api)
}
