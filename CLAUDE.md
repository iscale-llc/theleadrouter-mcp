# theLeadRouter — Lead Routing Platform

This file teaches Claude Code about the theLeadRouter platform — a B2B lead distribution system that routes leads from partners to buyers through offer-based contracts.

## First Time Here?

If the user is new to theLeadRouter or says anything like "get started", "I'm new", "help me set up", or "walk me through this" — run the `/welcome` skill. It will detect their role (admin, partner, or buyer) and walk them through setup step by step.

## Available Skills

| Skill | For | What it does |
|-------|-----|--------------|
| `/welcome` | Everyone | First-time setup wizard — detects role, checks MCP, guided walkthrough |
| `/admin-guide` | Admins | Full platform config reference — entities, routing engine, troubleshooting |
| `/partner-guide` | Partners | Lead submission, posting specs, campaigns, portal, API integration |
| `/buyer-guide` | Buyers | Contracts, filters, delivery, dedup, billing, returns, portal |

## Core Concepts

**Lead routing** = a partner submits a lead, the system evaluates which buyers want it, and delivers it to the winners.

### Entity Hierarchy

```
Tenant (organization)
│
├── Vertical Group (optional grouping of related verticals)
│   └── Vertical (lead category — "Solar", "Medicare", etc.)
│       └── Vertical Fields (custom fields for this lead type)
│
├── Partner (lead source — affiliate, publisher)
│   └── Campaign (program with posting key, pricing, caps)
│       └── Campaign Fields (extra fields beyond vertical fields)
│
├── Buyer (lead purchaser — advertiser, client)
│   └── Contract (agreement with filters, caps, pricing, delivery)
│
├── Offer (distribution hub — connects campaigns to contracts)
│   ├── Linked Campaigns (which campaigns feed leads in)
│   ├── Linked Contracts (which buyers are eligible)
│   └── DQ Contracts (fallback buyers for rejected leads)
│
└── Intake Center (buyer's CRM/backend system)
    └── Disposition Mappings (external status codes)
```

### How Routing Works

1. **Partner submits lead** via `POST /api/v1/leads/submit` with campaign's `postingKey` (lr_xxx)
2. **Campaign identifies the Offer** — which defines distribution rules
3. **Routing engine evaluates each Contract** linked to the offer:
   - Contract status = active?
   - Buyer status = active?
   - Buyer balance within credit limit?
   - Within contract's operating hours/schedule?
   - Geographic filters match (state/zip)?
   - Demographic filters match (age/gender)?
   - Custom filters match (vertical-specific fields)?
   - Cap limits not exceeded (daily/weekly/monthly)?
   - Dedup check passed (buyer hasn't received this person recently)?
4. **Winners selected** by distribution rule: highest price, priority rank, weighted random, or round-robin
5. **Lead delivered** to buyer endpoints
6. **If all rejected** — DQ contracts evaluated as fallback

### Distribution Types

| Type | Behavior |
|------|----------|
| `exclusive` | One buyer gets the lead (highest bid/priority wins) |
| `multisell` | All eligible buyers get a copy |
| `hybrid` | Top N buyers get the lead (configurable via maxSales) |

### Distribution Rules

| Rule | How winners are picked |
|------|----------------------|
| `price` | Highest pricePerLead wins |
| `priority` | Lowest priority number wins |
| `weight` | Random selection weighted by contract weight |
| `round_robin` | Rotate through eligible contracts |

## Setup Order

Entities must be created in this order (foreign key dependencies):

1. Vertical Group (optional)
2. Vertical (requires: vertical group if grouping)
3. Vertical Fields (requires: vertical)
4. Partner (standalone)
5. Buyer (standalone)
6. Intake Center (standalone)
7. Campaign (requires: partner + vertical)
8. Contract (requires: buyer + vertical)
9. Offer (requires: vertical)
10. Link Campaign to Offer
11. Link Contract to Offer

## Key Entities Reference

### Verticals
Lead categories. Every lead belongs to one vertical. Verticals define the field schema.
- **Admin UI:** Settings > Verticals
- **Key fields:** name, slug, verticalGroupId (optional), status

### Vertical Groups
Optional grouping of related verticals. Controls dedup and attribution scope.
- **dedupScope:** `offer` | `vertical` | `group` — how far duplicate detection reaches
- **attributionScope:** same options — how far attribution tracking reaches

### Partners
Organizations that submit leads (affiliates, publishers).
- **Admin UI:** Partners (sidebar)
- **Key fields:** name, email, status (active/paused/inactive), paymentCycle, balance

### Campaigns
A partner's specific lead program. Has its own posting key, pricing, and caps.
- **Admin UI:** Partners > [Partner] > Campaigns
- **Key fields:** partnerId, verticalId, postingKey (auto-generated lr_xxx), pricingModel (fixed/revshare), costPerLead, dailyCap/weeklyCap/monthlyCap, status

**Three-tier field architecture:**
1. **Global fields** (always present): firstName, lastName, email, phone, address, city, state, zipCode, dateOfBirth, ipAddress, tcpaConsent
2. **Vertical fields** (shared across campaigns in a vertical): e.g., utilityBill, homeOwner for Solar
3. **Campaign fields** (specific to one campaign): additional custom fields

**Lead submission:**
```
POST /api/v1/leads/submit
Authorization: Bearer lr_xxx  (campaign's postingKey)
Content-Type: application/json

{
  "campaignId": "uuid-or-display-id",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "5551234567",
  "zipCode": "90210",
  "ipAddress": "1.2.3.4",
  "tcpaConsent": true,
  "trustedFormCertUrl": "https://cert.trustedform.com/xxx",
  ...verticalFields,
  ...campaignFields
}
```

### Buyers
Organizations that purchase leads (advertisers, clients).
- **Admin UI:** Buyers (sidebar)
- **Key fields:** name, status, balance, creditLimit, dedupEnabled, dedupFields (default: email+phone), dedupWindowDays (default: 30)

### Contracts
A buyer's agreement to purchase leads. Defines what they want, how many, at what price, and how to deliver.
- **Admin UI:** Buyers > [Buyer] > Contracts

**Pricing:**
- pricingModel: `fixed` or `ping_post`
- pricePerLead: amount buyer pays
- exclusiveMultiplier: price multiplier for exclusive leads

**Filters:**
- geoFilters: `{ "states": ["CA", "TX"], "zipCodes": ["902*"] }`
- demographicFilters: `{ "minAge": 25, "maxAge": 65 }`
- customFilters: vertical-specific field requirements

**Caps:**
- Lead count: dailyLeadCap, weeklyLeadCap, monthlyLeadCap
- Spend: dailySpendCap, weeklySpendCap, monthlySpendCap

**Schedule:**
- scheduleTimezone (default: America/Los_Angeles)
- scheduleHours: operating hours per day of week
- Empty scheduleHours = 24/7

**Delivery:**
- deliveryMethodOverride / deliveryUrlOverride
- deliveryConfig: field mapping, headers
- intakeCenterId: link to intake center for delivery config

### Offers
The distribution hub. Connects campaigns (sources) to contracts (buyers).
- **Admin UI:** Offers (sidebar)
- **Key fields:** verticalId, distributionType, distributionRule, maxSales (for hybrid), visibility (public/private)
- **Tabs:** Basic Info, Campaigns (link sources), Contracts (link buyers + set weight/priority), DQ Contracts (fallback)

### Intake Centers
A buyer's CRM or backend system for lead delivery.
- **Admin UI:** Settings > Intake Centers
- **Key fields:** name, deliveryMethod (http_post/http_get/email), deliveryUrl, authMethod, authKeyName
- **Disposition mappings:** external status codes from buyer's system mapped to internal dispositions
- **Program cascades:** buyer's program codes mapped to specific contracts

## End-to-End Campaign Setup

1. **Create Vertical** (if new lead type) — Settings > Verticals, add fields
2. **Create Partner** — Partners > Create, set name/email/payment cycle
3. **Create Campaign** — Partner detail > Add Campaign, set vertical/pricing/caps
4. **Create Buyer** — Buyers > Create, set name/balance/dedup settings
5. **Create Intake Center** (if buyer has CRM) — Settings > Intake Centers
6. **Create Contract** — Buyer detail > Add Contract, set filters/caps/pricing/delivery
7. **Create Offer** — Offers > Create, set distribution type/rule
8. **Link Campaign to Offer** — Offer detail > Campaigns tab
9. **Link Contract to Offer** — Offer detail > Contracts tab, set weight/priority
10. **Test** — submit a test lead, check routing waterfall in lead detail

## Common Gotchas

1. **Vertical mismatch** — Campaign, contract, and offer must reference the SAME vertical
2. **Posting key vs API key** — postingKey (lr_xxx on campaign) is for lead submission, not the same as admin/partner API keys
3. **Buyer balance** — if balance exceeds creditLimit, contracts are skipped during routing
4. **Cap resets** — caps reset at midnight in the contract's scheduleTimezone, not UTC
5. **Inactive cascades** — pausing a buyer pauses all their contracts; pausing an offer can cascade to campaigns
6. **Dedup is buyer-level** — per-buyer, not global. Two different buyers can both receive the same person
7. **Offer needs both sides** — an offer with campaigns but no contracts = leads accepted but nowhere to route
8. **Schedule hours** — empty means 24/7; if set, leads outside hours are rejected (not queued)
9. **Filter format** — geo filters use state abbreviations ("CA" not "California"), zips support wildcards ("902*")
10. **DQ contracts are separate** — linked via DQ Contracts tab, not the regular Contracts tab

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/leads/submit` | Submit a lead (partner API) |
| `GET /api/v1/campaigns/{id}/posting` | Get posting spec for a campaign |
| `GET /api/admin/leads` | List leads (admin) |
| `GET /api/admin/leads/{id}` | Lead detail with routing info |
| `GET /api/admin/buyers` | List buyers |
| `GET /api/admin/partners` | List partners |
| `GET /api/admin/offers` | List offers |
| `GET /api/admin/contracts` | List contracts |
| `GET /api/admin/verticals` | List verticals |

## Auth

- **Admin dashboard:** Session-based (JWT in `lr_session` cookie)
- **Partner lead submission:** `Authorization: Bearer lr_xxx` (campaign postingKey)
- **Partner portal API:** Session cookie or partner API key
- **Buyer portal API:** Session cookie or buyer API key
- **Admin API:** `Authorization: Bearer lr_xxx` (admin API key)
