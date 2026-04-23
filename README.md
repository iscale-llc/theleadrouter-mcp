# theLeadRouter MCP — Claude Code Integration

[![Built with AI](https://img.shields.io/badge/Built%20with-AI-blue)](https://builtwithai.com)

Connect [Claude Code](https://claude.ai/code) to your [theLeadRouter](https://theleadrouter.com) lead routing platform. This repo provides:

1. **Role-specific skills** — teach Claude Code how theLeadRouter works from your perspective (admin, partner, or buyer)
2. **MCP server** — connects Claude Code to your instance via API so it can query leads, manage entities, pull reports, and more

**Built by [iSCALE](https://builtwithai.com) — AI-powered tools for lead generation at scale.**

## Quick Start

### Option 1: Clone this repo (recommended)

```bash
git clone https://github.com/iscale-llc/theleadrouter-mcp.git
cd theleadrouter-mcp
```

Then open Claude Code in this directory. It automatically loads the `CLAUDE.md` and all skills.

Say **"I'm new, help me get started"** or run `/welcome` — Claude Code will detect your role and walk you through setup step by step.

### Option 2: Copy just your role's skill

Copy only the skill you need into your project's `.claude/skills/` directory:

```bash
# For admins (full platform setup & management)
cp -r .claude/skills/admin-guide /path/to/your/project/.claude/skills/

# For partners (lead submission, campaigns, portal)
cp -r .claude/skills/partner-guide /path/to/your/project/.claude/skills/

# For buyers (contracts, filters, delivery, billing)
cp -r .claude/skills/buyer-guide /path/to/your/project/.claude/skills/
```

## Skills by Role

### Admin Guide (`/admin-guide`)

Full platform configuration and management:
- Entity hierarchy and setup order (verticals → partners → buyers → campaigns → contracts → offers)
- Routing engine internals — how the system evaluates contracts
- Distribution patterns (exclusive, multisell, hybrid, ping-post)
- Intake centers and delivery configuration
- Troubleshooting routing failures
- All admin API endpoints

### Partner Guide (`/partner-guide`)

Lead submission and campaign management:
- How to submit leads via API (`POST /api/v1/leads/submit`)
- Posting specs — required fields, sample requests, response formats
- Common rejection reasons and how to fix them
- Sessions API for multi-step funnels
- Co-registration flows
- Partner portal overview and API endpoints
- Campaign caps and pricing models

### Buyer Guide (`/buyer-guide`)

Receiving and managing leads:
- Contract configuration (filters, caps, pricing, schedule)
- Delivery setup (HTTP POST/GET, email, CRM integration)
- Dedup settings and how duplicate prevention works
- Balance, billing, and credit limits
- Returns and disposition tracking
- CPA (cost per acquisition) and conversion postbacks
- Ping-post auction model
- Buyer portal and API endpoints

## Setting Up the MCP Server

The MCP server lets Claude Code interact with your theLeadRouter instance directly — querying leads, managing buyers, pulling reports, etc.

### 1. Generate an API key

Go to **Settings > API Keys** in your admin dashboard and create an API key. It will start with `lr_`.

### 2. Add to your Claude Code config

Add the following to your `.mcp.json` file. Replace `lr_your_key_here` with your actual key.

```json
{
  "mcpServers": {
    "theleadrouter": {
      "command": "npx",
      "args": ["-y", "theleadrouter-mcp@latest"],
      "env": {
        "ISCALE_API_URL": "https://leads.iscale.com",
        "ISCALE_API_KEY": "lr_your_key_here"
      }
    }
  }
}
```

#### Optional scope filters

By default all ~300 tools (reads + writes) are registered. You can narrow the set to reduce context usage:

| Env var | Values | Effect |
|---|---|---|
| `ISCALE_MCP_SCOPE` | `read` \| `write` \| `all` (default) | Filter by write flag |
| `ISCALE_MCP_DOMAINS` | comma list, e.g. `verticals,campaigns,buyers` | Restrict to specific domains |
| `ISCALE_MCP_INCLUDE_UI` | `true` (default `false`) | Include admin-UI navigation tools (only useful inside the in-app agent) |

### 3. Restart Claude Code

Close and reopen Claude Code so it picks up the new MCP server config.

### 4. Verify the connection

Try asking: `"Use search_leads to show me recent leads"`

## MCP Server Tools

Once connected, Claude Code can use 300+ tools across these categories:

| Category | Examples |
|----------|----------|
| **Leads** | `search_leads`, `get_lead`, `get_lead_distributions`, `submit_lead` |
| **Buyers** | `list_buyers`, `get_buyer_balance`, `update_buyer_status` |
| **Partners** | `list_partners`, `get_partner`, `create_partner` |
| **Contracts** | `list_contracts`, `create_contract`, `update_contract_status` |
| **Campaigns** | `list_campaigns`, `get_posting_instructions` |
| **Offers** | `list_offers`, `link_campaign_to_offer` |
| **Reports** | `get_report`, `list_transactions`, `list_payouts` |
| **People (CRM)** | `search_people`, `get_person_timeline` |
| **Calls & IVR** | `list_calls`, `get_call`, `list_tracking_numbers` |
| **Compliance** | `check_suppression`, `list_audit_logs` |

## Example Prompts

### For Admins
```
"Set up a new solar vertical with fields for utilityBill and homeOwner"
"Create a campaign for partner SunLeads on the solar vertical"
"Why didn't lead L-12345 route to any buyers?"
"Show me all contracts that are hitting their daily cap"
"Pull a revenue report for last week grouped by buyer"
```

### For Partners
```
"Show me the posting spec for campaign C-789"
"What fields do I need to submit a solar lead?"
"Why was my last lead rejected?"
"Show me my leads from today and their statuses"
"What offers are available for me to enroll in?"
```

### For Buyers
```
"What's my current balance and credit limit?"
"Show me all leads I received today"
"Which of my contracts are paused?"
"Return lead L-12345 — invalid phone number"
"How many leads am I getting per day this week?"
```

## About

theLeadRouter is a B2B lead distribution platform that routes leads from partners to buyers through offer-based contracts. Learn more at [theleadrouter.com](https://theleadrouter.com).

Built by [iSCALE](https://builtwithai.com) — browse all our open-source AI tools at [builtwithai.com/open-source](https://builtwithai.com/open-source).

## Help & Documentation

- **User Manual:** Available in your admin dashboard under Help > User Manual
- **API Reference:** Help > API Docs
- **Claude Code tab:** Help > Claude Code (in-app setup instructions)
