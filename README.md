# iSCALE Lead Router — Claude Code Integration

Connect Claude Code to your iSCALE lead routing platform. This repo provides:

1. **Role-specific skills** — teach Claude Code how iSCALE works from your perspective (admin, partner, or buyer)
2. **MCP server config** — connects Claude Code to your iSCALE instance via API so it can query leads, manage entities, pull reports, and more

## Quick Start

### Option 1: Clone this repo (recommended)

```bash
git clone https://github.com/iscale-llc/lead-router-public.git
cd lead-router-public
```

Then open Claude Code in this directory. It automatically loads the `CLAUDE.md` and all three role skills.

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

The MCP server lets Claude Code interact with your iSCALE instance directly — querying leads, managing buyers, pulling reports, etc.

### 1. Generate an API key

Go to **Settings > API Keys** in your iSCALE admin dashboard and create an API key. It will start with `lr_`.

### 2. Add to your Claude Code config

Add the following to your `.mcp.json` file. Replace `lr_your_key_here` with your actual key.

```json
{
  "mcpServers": {
    "iscale": {
      "command": "npx",
      "args": ["-y", "@iscale/mcp"],
      "env": {
        "ISCALE_API_URL": "https://leads.iscale.com",
        "ISCALE_API_KEY": "lr_your_key_here"
      }
    }
  }
}
```

### 3. Restart Claude Code

Close and reopen Claude Code so it picks up the new MCP server config.

### 4. Verify the connection

Try asking: `"Use search_leads to show me recent leads"`

## MCP Server Tools

Once connected, Claude Code can use these tools:

| Tool | Description |
|------|-------------|
| `search_leads` | Search and filter leads |
| `get_lead` | Get full lead details |
| `get_lead_distributions` | View routing waterfall |
| `list_buyers` | List buyers with filters |
| `get_buyer_balance` | Check buyer balance and billing |
| `update_buyer_status` | Activate/pause/disable buyers |
| `list_partners` | List partners |
| `list_contracts` | List contracts with filters |
| `update_contract_status` | Activate/pause contracts |
| `list_campaigns` | List campaigns |
| `get_posting_instructions` | Get campaign posting spec |
| `list_offers` | List offers |
| `list_verticals` | List verticals (lead categories) |
| `get_report` | Pull lead/revenue/buyer reports |
| `list_transactions` | View financial transactions |
| `search_people` | Search lead contacts |
| `get_person_timeline` | View person activity history |
| `check_suppression` | Check suppression lists |
| `create_contract` | Create a new contract with full config |
| `setup_partner_onboarding` | Guided multi-step partner onboarding |

Plus 300+ additional auto-generated tools covering the full API surface.

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

## Help & Documentation

- **User Manual:** Available in your iSCALE admin dashboard under Help > User Manual
- **API Reference:** Help > API Docs
- **Postman Collection:** Help > Postman Collection
- **Claude Code tab:** Help > Claude Code (in-app setup instructions)
