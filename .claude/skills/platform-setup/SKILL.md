---
name: platform-setup
description: "Guide for configuring iSCALE lead routing — verticals, partners, buyers, campaigns, offers, contracts, intake centers, and end-to-end campaign setup. Use when setting up new campaigns, onboarding partners/buyers, or understanding platform configuration."
user_invocable: true
allowed_tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# iSCALE Platform Setup Guide

Comprehensive guide for configuring the iSCALE lead routing platform. Covers entity hierarchy, setup order, and configuration details for each component.

## When to use
- Setting up a new campaign from scratch
- Onboarding a new partner or buyer
- Creating verticals, offers, or contracts
- Understanding how entities relate to each other
- Configuring intake centers for lead delivery
- Troubleshooting "why can't I create a campaign?" type questions

## Platform Entity Hierarchy

Understanding the entity relationships is critical. Everything flows from this hierarchy:

```
Tenant (organization)
│
├── Vertical Group (optional grouping)
│   ├── Vertical (lead category — "Solar", "Medicare", etc.)
│   │   ├── Vertical Fields (shared fields for this lead type)
│   │   └── Vertical Group Dispositions (outcome codes)
│   │
│   └── Vertical (another category in same group)
│
├── Partner (lead source — affiliate, publisher)
│   ├── Campaign (specific program with posting key)
│   │   └── Campaign Fields (extra fields beyond vertical fields)
│   └── API Keys (for partner portal access)
│
├── Buyer (lead purchaser — advertiser, client)
│   ├── Contract (agreement with filters, caps, pricing)
│   │   └── Delivery Config (how leads get sent to buyer)
│   └── API Keys (for buyer portal access)
│
├── Offer (distribution hub — connects campaigns to contracts)
│   ├── Offer ↔ Campaign links (which campaigns feed this offer)
│   ├── Offer ↔ Contract links (which buyers are eligible)
│   └── DQ Contracts (fallback buyers for rejected leads)
│
└── Intake Center (buyer's CRM/backend system)
    ├── Disposition Mappings (external status → internal status)
    └── Program Cascades (program codes → contract routing)
```

## Setup Order (Dependencies)

Entities must be created in this order because of foreign key dependencies:

```
1. Vertical Group (optional)
2. Vertical (requires: vertical group if grouping)
3. Vertical Fields (requires: vertical)
4. Partner (standalone)
5. Buyer (standalone)
6. Intake Center (standalone, but associated with buyer via contract)
7. Campaign (requires: partner, vertical)
8. Contract (requires: buyer, vertical)
9. Offer (requires: vertical)
10. Link Campaign → Offer (requires: both exist)
11. Link Contract → Offer (requires: both exist)
```

## Entity Details

### 1. Vertical Groups

**What:** Optional grouping of related verticals. Controls dedup and attribution scope.

**Admin UI:** Settings > Verticals > Vertical Groups tab

**Key fields:**
| Field | Purpose | Options |
|-------|---------|---------|
| name | Display name | e.g., "Mass Tort", "Insurance" |
| dedupScope | How far dedup reaches | `offer` (per offer), `vertical` (per vertical), `group` (across verticals in group) |
| attributionScope | How far attribution reaches | Same options as dedupScope |

**When to use groups:** When you have related verticals (e.g., "Auto Insurance" and "Home Insurance") and want dedup/attribution to work across them.

**When to skip:** Single-vertical setups or verticals with no dedup relationship.

### 2. Verticals

**What:** Lead categories. Every lead belongs to exactly one vertical. Verticals define the field schema for leads.

**Admin UI:** Settings > Verticals

**Key fields:**
| Field | Purpose | Example |
|-------|---------|---------|
| name | Display name | "Solar", "Medicare Supplement" |
| slug | URL-safe identifier | "solar", "medicare-supplement" |
| verticalGroupId | Parent group (optional) | Links to vertical group |
| status | Active/inactive | `active`, `inactive` |
| settings | JSONB config | Custom vertical behavior |

**Important:** Verticals are the backbone of the system. Campaigns, contracts, and offers all reference a vertical.

### 3. Vertical Fields

**What:** Fields shared across all campaigns in a vertical. These extend the base lead fields (firstName, lastName, email, phone, etc.).

**Admin UI:** Settings > Verticals > [Vertical] > Fields tab

**Three-tier field architecture:**
1. **Global fields** (system-wide, always present): firstName, lastName, email, phone, address, city, state, zipCode, dateOfBirth, ipAddress, tcpaConsent, trustedFormCertUrl
2. **Vertical fields** (per vertical): e.g., Solar might have `utilityBill`, `homeOwner`, `roofType`
3. **Campaign fields** (per campaign): additional fields specific to one campaign

**Key field properties:**
| Property | Purpose |
|----------|---------|
| name | camelCase field name (stored in lead's `custom` JSONB) |
| label | Human-readable display name |
| type | `text`, `number`, `boolean`, `date`, `select`, `email`, `phone`, `url` |
| required | Whether the field must be present on lead submission |
| options | For `select` type: array of allowed values |
| validation | Optional regex or min/max rules |

### 4. Partners

**What:** Organizations that submit leads. Affiliates, publishers, lead generators.

**Admin UI:** Partners (sidebar)

**Key fields:**
| Field | Purpose |
|-------|---------|
| name | Company/partner name |
| email | Primary contact email |
| phone | Contact phone |
| status | `active`, `paused`, `inactive` |
| paymentCycle | `weekly`, `bimonthly`, `monthly`, `adhoc` |
| balance | Running balance owed to partner |

**After creating a partner:**
- Create one or more Campaigns under this partner
- Optionally create API keys for partner portal access (Settings > API Keys on partner detail page)

### 5. Buyers

**What:** Organizations that purchase leads. Advertisers, clients, law firms, insurance agencies.

**Admin UI:** Buyers (sidebar)

**Key fields:**
| Field | Purpose |
|-------|---------|
| name | Company name |
| email | Primary contact |
| status | `active`, `paused`, `suspended`, `inactive` |
| balance | Amount buyer owes (increases with purchases) |
| creditLimit | Max allowed balance before pausing |
| dedupEnabled | Whether to check for duplicate leads |
| dedupFields | Which fields to hash for dedup (default: email, phone) |
| dedupWindowDays | How long to remember leads for dedup (default: 30) |
| brandName | For TCPA compliance — the brand name shown in consent language |

**After creating a buyer:**
- Create one or more Contracts under this buyer
- Configure delivery method (how leads get sent)
- Optionally set up an Intake Center if buyer has a CRM system

### 6. Intake Centers

**What:** A buyer's CRM or backend system where leads get delivered. Defines delivery method, auth, and disposition mapping.

**Admin UI:** Settings > Intake Centers

**Key fields:**
| Field | Purpose |
|-------|---------|
| name | System name (e.g., "Salesforce", "LeadByte", "Custom CRM") |
| deliveryMethod | `http_post`, `http_get`, `email` |
| deliveryUrl | Endpoint URL for HTTP delivery |
| baseUrl | Base URL for the system |
| authMethod | `header`, `body`, `query` — where to put auth credentials |
| authKeyName | Name of the auth parameter |
| deliveryConfig | JSONB — additional delivery settings |
| statusMappings | JSONB — maps external statuses to internal |

**Intake Center Dispositions:**
Maps the buyer's CRM status codes back to your unified disposition system:
- External code (what buyer's system returns) → Internal verticalGroupDisposition
- Example: Buyer returns `"SOLD"` → maps to your `"converted"` disposition

**Program Cascades:**
Maps program codes to contracts for routing:
- Buyer may have multiple "programs" in their CRM
- Each program maps to a specific contract in iSCALE

**Linking to contracts:** Set `intakeCenterId` on the contract to use this intake center's delivery config.

### 7. Campaigns

**What:** A specific lead program run by a partner. Has its own posting key, pricing, caps, and fields.

**Admin UI:** Partners > [Partner] > Campaigns tab, or Partners > Campaigns (top-level list)

**Key fields:**
| Field | Purpose |
|-------|---------|
| partnerId | Which partner owns this campaign (required) |
| verticalId | What type of leads (required) |
| name | Campaign name |
| postingKey | Auto-generated `lr_xxx` key — partners use this to submit leads |
| pricingModel | `fixed` or `revshare` |
| costPerLead | Amount paid TO the partner per lead |
| dailyCap / weeklyCap / monthlyCap | Lead volume limits |
| status | `active`, `paused`, `inactive` |

**Campaign Fields:** (campaign detail > Fields tab)
- Click "Load Fields" to see inherited global + vertical fields
- Add campaign-specific fields on top
- Field names must be camelCase and not conflict with existing field names

**Posting Spec:** Each campaign has a posting spec endpoint:
- `GET /api/v1/campaigns/{id}/posting` — returns required fields, sample body, endpoint URL
- Partners use this to integrate their lead submission

**How partners submit leads:**
```
POST /api/v1/leads/submit
Authorization: Bearer lr_xxx  (the campaign's postingKey)
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

### 8. Contracts

**What:** A buyer's agreement to purchase leads. Defines what leads the buyer wants (filters), how many (caps), at what price, and how to deliver them.

**Admin UI:** Buyers > [Buyer] > Contracts tab

**Key fields:**

**Basics:**
| Field | Purpose |
|-------|---------|
| buyerId | Which buyer (required) |
| verticalId | What lead type (required) |
| name | Contract name |
| status | `active`, `paused`, `expired` |
| priority | For priority-based distribution (lower = higher priority) |

**Pricing:**
| Field | Purpose |
|-------|---------|
| pricingModel | `fixed` or `ping_post` |
| pricePerLead | Amount buyer pays per lead |
| exclusiveMultiplier | Price multiplier for exclusive leads (default: 1.0) |
| allowMultiSale | Whether this contract participates in multisell |
| revenueOnAcceptance | Book revenue when lead accepted (default: true) |

**Filters (which leads the buyer wants):**
| Filter Type | Field | Example |
|-------------|-------|---------|
| Geographic | geoFilters | `{ "states": ["CA", "TX"], "zipCodes": ["902*"] }` |
| Demographic | demographicFilters | `{ "minAge": 25, "maxAge": 65 }` |
| Custom | customFilters | `{ "homeOwner": true, "utilityBill": { "min": 100 } }` |
| Unified | filters | New format — array of filter objects |

**Caps (volume limits):**
| Cap Type | Fields |
|----------|--------|
| Lead count | dailyLeadCap, weeklyLeadCap, monthlyLeadCap |
| Spend | dailySpendCap, weeklySpendCap, monthlySpendCap |

**Schedule:**
| Field | Purpose |
|-------|---------|
| scheduleTimezone | Timezone for schedule evaluation (default: America/Los_Angeles) |
| scheduleHours | JSONB — hours of operation per day of week |
| expiresAt | Contract expiration date |

**Delivery:**
| Field | Purpose |
|-------|---------|
| deliveryMethodOverride | Override intake center method |
| deliveryUrlOverride | Override intake center URL |
| deliveryConfig | JSONB — field mapping, headers, etc. |
| intakeCenterId | Link to intake center for delivery config |

**CPA (Cost Per Acquisition):**
| Field | Purpose |
|-------|---------|
| cpaAmount | Bonus paid on conversion |
| cpaWindowDays | Days to wait for conversion before expiring |

### 9. Offers

**What:** The distribution hub. Connects campaigns (lead sources) to contracts (buyers). Controls HOW leads get distributed.

**Admin UI:** Offers (sidebar)

**Key fields:**

**Distribution:**
| Field | Purpose | Options |
|-------|---------|---------|
| distributionType | How many buyers get the lead | `exclusive` (1 buyer), `multisell` (all eligible), `hybrid` (N buyers) |
| distributionRule | How to pick winners | `price` (highest bid), `priority` (lowest number), `weight` (random weighted), `round_robin` (rotate) |
| maxSales | For hybrid: max buyers per lead | integer |

**Default Payout:**
| Field | Purpose |
|-------|---------|
| defaultPayoutModel | `fixed` or `revshare` |
| defaultPayoutAmount | Default amount (contracts can override) |

**Dedup:**
| Field | Purpose |
|-------|---------|
| crossPartnerDedup | Check dupes across different partners (default: true) |
| crossPartnerDedupWindowDays | How many days to look back (default: 30) |

**Visibility:**
| Field | Purpose |
|-------|---------|
| visibility | `public` (shows in partner marketplace) or `private` |

**After creating an offer:**
1. **Link campaigns** — Offer detail > Campaigns tab > add campaigns that feed leads into this offer
2. **Link contracts** — Offer detail > Contracts tab > add buyer contracts eligible to receive leads
3. **Set weights/priorities** — On each linked contract, set weight (for weighted distribution) or priority (for priority-based)
4. **Optionally add DQ contracts** — Offer detail > DQ Contracts tab > add fallback buyers for rejected leads

## End-to-End Campaign Setup Walkthrough

Here's the complete sequence to set up a new campaign from nothing:

### Step 1: Create the Vertical (if new lead type)
1. Go to Settings > Verticals
2. Create vertical with name and slug
3. Optionally assign to a vertical group
4. Add vertical fields (the custom fields all campaigns in this vertical will share)

### Step 2: Create the Partner
1. Go to Partners > Create Partner
2. Fill in name, email, payment cycle
3. Save — partner starts as `active`

### Step 3: Create the Campaign
1. From partner detail page, click "Add Campaign"
2. Set: name, vertical, pricing model, cost per lead
3. Set caps if needed (daily/weekly/monthly)
4. Save — campaign gets a `postingKey` (lr_xxx) automatically
5. Optionally add campaign-specific fields (Fields tab)

### Step 4: Create the Buyer
1. Go to Buyers > Create Buyer
2. Fill in name, email, balance settings
3. Configure dedup if needed (enable, set fields, window days)
4. Save — buyer starts as `active`

### Step 5: Create the Intake Center (if buyer has a CRM)
1. Go to Settings > Intake Centers > Create
2. Set delivery method (http_post, http_get, email)
3. Configure delivery URL and auth
4. Map disposition codes if needed

### Step 6: Create the Contract
1. From buyer detail page, click "Add Contract"
2. Set: name, vertical (must match campaign's vertical), pricing
3. Configure filters (geo, demographic, custom)
4. Set caps (lead count and/or spend caps)
5. Set schedule (operating hours, timezone)
6. Link intake center if applicable
7. Configure delivery (URL, field mapping)

### Step 7: Create the Offer
1. Go to Offers > Create Offer
2. Set: name, vertical (must match campaign and contract verticals)
3. Choose distribution type (exclusive/multisell/hybrid) and rule (price/priority/weight/round_robin)
4. Set default payout

### Step 8: Link Everything Together
1. Offer detail > Campaigns tab: add the campaign(s)
2. Offer detail > Contracts tab: add the contract(s)
3. Set weights or priorities on each linked contract
4. Optionally add DQ contracts for fallback

### Step 9: Test the Flow
1. Get the campaign's posting spec: `GET /api/v1/campaigns/{id}/posting`
2. Submit a test lead using the posting key
3. Check lead routing: lead should appear with status `sold` (or `matched` for multisell)
4. Verify lead delivery to buyer's endpoint
5. Check routing waterfall in lead detail (Lead > Distributions tab)

## Common Configuration Patterns

### Exclusive Distribution (One Buyer Gets the Lead)
- Offer distributionType: `exclusive`
- Offer distributionRule: `price` (highest bidder wins) or `priority` (fixed ranking)
- Each contract has a pricePerLead — highest price wins

### Multisell (All Eligible Buyers Get the Lead)
- Offer distributionType: `multisell`
- Every contract that passes filters/caps/dedup gets a copy
- Each buyer pays their contract price

### Hybrid (Top N Buyers)
- Offer distributionType: `hybrid`
- Offer maxSales: 3 (for example)
- Top 3 eligible contracts by price/priority get the lead

### Ping-Post (Real-Time Auction)
- Contract pricingModel: `ping_post`
- Routing engine pings buyers with lead attributes (no PII)
- Buyers bid, highest bid wins
- Lead data delivered to winner(s)

### DQ/Fallback Distribution
- Offer detail > DQ Contracts tab
- Leads rejected by primary contracts route to DQ buyers
- Usually at lower price point
- Can inherit or override filters/dedup

## Routing Engine Evaluation Order

When a lead comes in, the routing engine evaluates contracts in this order:

1. **Offer lookup** — find the offer linked to the campaign
2. **Contract collection** — get all contracts linked to the offer
3. **For each contract, check (in order):**
   a. Contract status = active?
   b. Buyer status = active?
   c. Buyer balance < credit limit?
   d. Contract schedule — within operating hours?
   e. Geographic filters — lead's state/zip matches?
   f. Demographic filters — age/gender matches?
   g. Custom filters — vertical-specific field matches?
   h. Cap check — daily/weekly/monthly limits not exceeded?
   i. Dedup check — buyer hasn't received this person recently?
4. **Rank eligible contracts** by distribution rule (price/priority/weight/round_robin)
5. **Select winners** based on distribution type (1 for exclusive, all for multisell, N for hybrid)
6. **Create LeadSale records** for each winner
7. **Deliver leads** to buyer endpoints
8. **If all rejected** — try DQ contracts (if configured)

## Key API Endpoints for Configuration

| Endpoint | Purpose |
|----------|---------|
| `POST /api/admin/verticals` | Create vertical |
| `POST /api/admin/partners` | Create partner |
| `POST /api/admin/partners/{id}/campaigns` | Create campaign under partner |
| `POST /api/admin/buyers` | Create buyer |
| `POST /api/admin/buyers/{id}/contracts` | Create contract under buyer |
| `POST /api/admin/offers` | Create offer |
| `POST /api/admin/offers/{id}/campaigns` | Link campaign to offer |
| `POST /api/admin/offers/{id}/contracts` | Link contract to offer |
| `GET /api/v1/campaigns/{id}/posting` | Get posting spec |
| `POST /api/v1/leads/submit` | Submit a lead |
| `GET /api/admin/leads/{id}` | View lead + routing details |

## Gotchas & Common Mistakes

1. **Vertical mismatch** — Campaign, contract, and offer must all reference the SAME vertical. Mismatched verticals = leads won't route.

2. **Posting key confusion** — The `postingKey` (lr_xxx) on a campaign is what partners use to submit leads. It's NOT the same as admin API keys or partner portal API keys.

3. **Buyer balance** — If a buyer's balance exceeds their creditLimit, their contracts are skipped during routing. Fund the buyer's account or increase the limit.

4. **Cap periods** — Caps reset at midnight in the contract's `scheduleTimezone` (default: America/Los_Angeles), not UTC.

5. **Inactive entities cascade** — Pausing a buyer pauses all their contracts. Pausing an offer can cascade to campaigns. Check parent entity status when debugging "why isn't this routing?"

6. **Dedup is buyer-level** — Dedup checks are per-buyer, not global. Buyer A and Buyer B can both receive the same person. Cross-partner dedup on the offer prevents the same person from being submitted by different partners.

7. **Filter format** — Geo filters use state abbreviations ("CA", not "California"). Zip codes support wildcards ("902*" matches 90201-90299).

8. **Schedule hours** — Empty scheduleHours means 24/7. If set, leads outside hours are rejected (not queued).

9. **Offer must have both campaigns AND contracts** — An offer with campaigns but no contracts = leads accepted but nowhere to route. An offer with contracts but no campaigns = no leads flowing in.

10. **DQ contracts are separate** — They're linked via the DQ Contracts tab, not the regular Contracts tab. They have their own distribution rule.
