# iSCALE Lead Router — Claude Code Integration

Connect Claude Code to your iSCALE lead routing platform. This repo provides:

1. **Platform knowledge skill** — teaches Claude Code how iSCALE works (verticals, campaigns, offers, contracts, routing engine, etc.)
2. **MCP server config** — connects Claude Code to your iSCALE instance via API so it can query leads, manage buyers, pull reports, and more

## Quick Start

### Option 1: Clone this repo (recommended)

```bash
git clone https://github.com/iscale-llc/lead-router-public.git
cd lead-router-public
```

Then open Claude Code in this directory. It will automatically load the `CLAUDE.md` and the platform setup skill.

### Option 2: Copy the skill into your project

Copy the `.claude/skills/platform-setup/` folder into your own project's `.claude/skills/` directory:

```bash
cp -r .claude/skills/platform-setup /path/to/your/project/.claude/skills/
```

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

## What's Included

### Platform Knowledge (`CLAUDE.md` + Skill)

The `CLAUDE.md` file and `.claude/skills/platform-setup/` skill teach Claude Code:

- **Entity hierarchy** — how verticals, partners, buyers, campaigns, offers, contracts, and intake centers relate
- **Setup order** — what must exist before what (dependency chain)
- **Field reference** — key fields for each entity with purpose and options
- **End-to-end walkthrough** — 9-step sequence from creating a vertical through testing a live lead
- **Distribution patterns** — exclusive, multisell, hybrid, ping-post, DQ/fallback
- **Routing engine** — the exact evaluation order (status, balance, schedule, filters, caps, dedup, rank, select)
- **Common gotchas** — vertical mismatch, posting key confusion, cap resets, cascade behaviors

### MCP Server Tools

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

Once set up, try these with Claude Code:

```
"Show me all leads from today that failed routing"
"What's the balance for buyer Acme Corp?"
"Set up a new solar campaign for partner SunLeads"
"Why didn't lead L-12345 route to any buyers?"
"Pull a revenue report for last week grouped by buyer"
"List all contracts that are hitting their daily cap"
"What are the posting instructions for campaign C-789?"
```

## Help & Documentation

- **User Manual:** Available in your iSCALE admin dashboard under Help > User Manual
- **API Reference:** Help > API Docs
- **Postman Collection:** Help > Postman Collection
