---
name: admin-guide
description: "Admin guide for iSCALE lead routing — full platform setup, entity management, routing configuration, reports, compliance. Use when configuring verticals, partners, buyers, campaigns, offers, contracts, intake centers, or troubleshooting routing."
user_invocable: true
allowed_tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# iSCALE Admin Guide

Complete guide for platform administrators. Covers entity setup, routing configuration, reports, and troubleshooting.

## When to use
- Setting up the platform from scratch
- Onboarding new partners or buyers
- Creating verticals, campaigns, offers, or contracts
- Configuring intake centers and delivery
- Understanding how routing decisions work
- Troubleshooting why leads aren't routing
- Pulling reports or managing compliance

## Platform Overview

iSCALE is a B2B lead distribution platform. Partners submit leads, the routing engine evaluates which buyers want them, and delivers leads to the winners.

```
Partner submits lead → Campaign → Offer → Routing Engine → Contract(s) → Buyer(s)
```

## Entity Hierarchy

```
Tenant (your organization)
│
├── Vertical Group (optional — groups related verticals)
│   └── Vertical (lead category: "Solar", "Medicare", etc.)
│       ├── Vertical Fields (custom fields for this lead type)
│       └── Vertical Group Dispositions (outcome codes)
│
├── Partner (lead source — affiliate, publisher)
│   ├── Campaign (program with posting key, pricing, caps)
│   │   └── Campaign Fields (extra fields beyond vertical)
│   └── API Keys (partner portal access)
│
├── Buyer (lead purchaser — advertiser, client)
│   ├── Contract (filters, caps, pricing, delivery config)
│   └── API Keys (buyer portal access)
│
├── Offer (distribution hub)
│   ├── Linked Campaigns (lead sources)
│   ├── Linked Contracts (eligible buyers)
│   └── DQ Contracts (fallback buyers)
│
└── Intake Center (buyer's CRM/backend)
    ├── Disposition Mappings
    └── Program Cascades
```

## Setup Order (Dependencies)

Create entities in this order — each requires the previous:

```
1. Vertical Group (optional)
2. Vertical
3. Vertical Fields
4. Partner (standalone)
5. Buyer (standalone)
6. Intake Center (standalone)
7. Campaign (requires: partner + vertical)
8. Contract (requires: buyer + vertical)
9. Offer (requires: vertical)
10. Link Campaign → Offer
11. Link Contract → Offer
```

## Entity Configuration Reference

### Vertical Groups

**Location:** Settings > Verticals > Vertical Groups tab

| Field | Purpose | Options |
|-------|---------|---------|
| name | Display name | e.g., "Mass Tort", "Insurance" |
| dedupScope | How far dedup reaches | `offer`, `vertical`, `group` |
| attributionScope | Attribution tracking scope | `offer`, `vertical`, `group` |

**When to use:** Related verticals (e.g., "Auto Insurance" + "Home Insurance") where dedup/attribution should work across them.

### Verticals

**Location:** Settings > Verticals

Every lead belongs to exactly one vertical. Verticals define the field schema.

| Field | Purpose |
|-------|---------|
| name | Display name ("Solar", "Medicare Supplement") |
| slug | URL-safe identifier ("solar", "medicare-supplement") |
| verticalGroupId | Optional parent group |
| status | `active` / `inactive` |

**Three-tier field architecture:**
1. **Global fields** (always present): firstName, lastName, email, phone, address, city, state, zipCode, dateOfBirth, ipAddress, tcpaConsent, trustedFormCertUrl
2. **Vertical fields** (per vertical): e.g., Solar → utilityBill, homeOwner, roofType
3. **Campaign fields** (per campaign): additional fields for one specific campaign

### Partners

**Location:** Partners (sidebar)

| Field | Purpose |
|-------|---------|
| name | Company/partner name |
| email | Primary contact |
| status | `active`, `paused`, `inactive` |
| paymentCycle | `weekly`, `bimonthly`, `monthly`, `adhoc` |
| balance | Running balance owed to partner |

**After creating:** Create campaigns, optionally create API keys for portal access.

### Campaigns

**Location:** Partners > [Partner] > Campaigns tab

| Field | Purpose |
|-------|---------|
| partnerId | Owner partner (required) |
| verticalId | Lead type (required) |
| postingKey | Auto-generated `lr_xxx` — partners use this to submit leads |
| pricingModel | `fixed` or `revshare` |
| costPerLead | Amount paid TO the partner per lead |
| dailyCap / weeklyCap / monthlyCap | Volume limits |
| status | `active`, `paused`, `inactive` |

**Campaign Fields** (campaign detail > Fields tab):
- Click "Load Fields" to see inherited global + vertical fields
- Add campaign-specific fields (must be camelCase, no conflicts)
- Types: text, number, boolean, date, select, email, phone, url

**Posting Spec:** `GET /api/v1/campaigns/{id}/posting` — returns required fields, sample body, endpoint URL.

### Buyers

**Location:** Buyers (sidebar)

| Field | Purpose |
|-------|---------|
| name | Company name |
| status | `active`, `paused`, `suspended`, `inactive` |
| balance | Amount buyer owes (increases with purchases) |
| creditLimit | Max balance before pausing |
| dedupEnabled | Check for duplicate leads |
| dedupFields | Which fields to hash (default: email, phone) |
| dedupWindowDays | Days to remember leads (default: 30) |
| brandName | Brand name for TCPA consent language |

**After creating:** Create contracts, configure delivery, optionally set up intake center.

### Contracts

**Location:** Buyers > [Buyer] > Contracts tab

The most complex entity — defines what the buyer wants, how many, at what price, and how to deliver.

**Pricing:**
| Field | Purpose |
|-------|---------|
| pricingModel | `fixed` or `ping_post` |
| pricePerLead | Amount buyer pays |
| exclusiveMultiplier | Price multiplier for exclusive (default: 1.0) |
| allowMultiSale | Participates in multisell? |

**Filters:**
| Type | Field | Example |
|------|-------|---------|
| Geographic | geoFilters | `{ "states": ["CA", "TX"], "zipCodes": ["902*"] }` |
| Demographic | demographicFilters | `{ "minAge": 25, "maxAge": 65 }` |
| Custom | customFilters | `{ "homeOwner": true, "utilityBill": { "min": 100 } }` |

**Caps:**
| Type | Fields |
|------|--------|
| Lead count | dailyLeadCap, weeklyLeadCap, monthlyLeadCap |
| Spend | dailySpendCap, weeklySpendCap, monthlySpendCap |

**Schedule:**
- scheduleTimezone (default: America/Los_Angeles)
- scheduleHours: hours per day of week (empty = 24/7)
- expiresAt: contract expiration date

**Delivery:**
- deliveryMethodOverride / deliveryUrlOverride
- deliveryConfig: field mapping, headers
- intakeCenterId: link to intake center

**CPA:**
- cpaAmount: bonus paid on conversion
- cpaWindowDays: days to wait for conversion

### Offers

**Location:** Offers (sidebar)

The distribution hub — connects campaigns (sources) to contracts (buyers).

**Distribution:**
| Field | Purpose | Options |
|-------|---------|---------|
| distributionType | How many buyers | `exclusive` (1), `multisell` (all), `hybrid` (N) |
| distributionRule | How to pick winners | `price`, `priority`, `weight`, `round_robin` |
| maxSales | For hybrid mode | integer |

**Default Payout:**
- defaultPayoutModel: `fixed` or `revshare`
- defaultPayoutAmount: default amount (contracts can override)

**Dedup:**
- crossPartnerDedup: check dupes across partners (default: true)
- crossPartnerDedupWindowDays: lookback window (default: 30)

**Tabs:**
1. **Basic Info** — core settings
2. **Campaigns** — link lead sources
3. **Contracts** — link buyers, set weight/priority per contract
4. **DQ Contracts** — fallback buyers for rejected leads

### Intake Centers

**Location:** Settings > Intake Centers

Buyer's CRM or backend system.

| Field | Purpose |
|-------|---------|
| name | System name ("Salesforce", "Custom CRM") |
| deliveryMethod | `http_post`, `http_get`, `email` |
| deliveryUrl | Endpoint URL |
| authMethod | `header`, `body`, `query` |
| authKeyName | Name of auth parameter |

**Disposition Mappings:** Map buyer's CRM status codes → internal dispositions.
**Program Cascades:** Map program codes → specific contracts for routing.

## Routing Engine — How It Works

When a lead arrives:

1. **Identify offer** — campaign → offer link
2. **Collect contracts** — all contracts linked to the offer
3. **Evaluate each contract (in order):**
   - a. Contract status = active?
   - b. Buyer status = active?
   - c. Buyer balance < credit limit?
   - d. Within schedule hours?
   - e. Geo filters match (state/zip)?
   - f. Demographic filters match?
   - g. Custom filters match?
   - h. Caps not exceeded (daily/weekly/monthly)?
   - i. Dedup check passed?
4. **Rank eligible contracts** by distribution rule
5. **Select winners** by distribution type (1 / all / N)
6. **Create LeadSale records**
7. **Deliver leads** to buyer endpoints
8. **If all rejected** → try DQ contracts

## Distribution Patterns

### Exclusive (One Winner)
- distributionType: `exclusive`
- distributionRule: `price` or `priority`
- Highest bid or top priority contract gets the lead

### Multisell (All Eligible)
- distributionType: `multisell`
- Every passing contract gets a copy
- Each buyer pays their contract price

### Hybrid (Top N)
- distributionType: `hybrid`, maxSales: 3
- Top 3 eligible contracts get the lead

### Ping-Post (Real-Time Auction)
- Contract pricingModel: `ping_post`
- Routing engine pings buyers with lead attributes (no PII)
- Buyers bid, highest wins, PII delivered to winner

### DQ/Fallback
- Offer > DQ Contracts tab
- Rejected leads route to fallback buyers at lower price
- Separate distribution rule from primary contracts

## Troubleshooting Routing

**No leads routing at all?**
- Check offer has BOTH campaigns AND contracts linked
- Check campaign, contract, buyer, offer all have status = `active`
- Check buyer balance hasn't exceeded creditLimit

**Lead rejected — "Cap Exceeded"?**
- Check contract's daily/weekly/monthly caps
- Caps reset at midnight in contract's scheduleTimezone

**Lead rejected — "Duplicate Lead"?**
- Buyer already received this person within dedupWindowDays
- Check buyer's dedupFields (default: email + phone)

**Lead rejected — filter mismatch?**
- Check contract's geoFilters (state abbreviations, zip wildcards)
- Check demographicFilters and customFilters
- Verify lead data matches expected formats

**Lead accepted but delivery failed?**
- Check deliveryUrl on contract or intake center
- Check auth configuration
- View delivery response in lead detail > Distributions tab

## Key API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/admin/leads` | List leads |
| `GET /api/admin/leads/{id}` | Lead detail + routing waterfall |
| `GET /api/admin/buyers` | List buyers |
| `GET /api/admin/partners` | List partners |
| `GET /api/admin/offers` | List offers |
| `GET /api/admin/contracts` | List contracts |
| `GET /api/admin/verticals` | List verticals |
| `POST /api/admin/verticals` | Create vertical |
| `POST /api/admin/partners` | Create partner |
| `POST /api/admin/buyers` | Create buyer |
| `POST /api/admin/offers` | Create offer |
| `GET /api/v1/campaigns/{id}/posting` | Get posting spec |
| `POST /api/v1/leads/submit` | Submit test lead |

## People (CRM)

The People section is a person-level CRM. Every lead creates or updates a person record (matched by email/phone). People aggregate all activity for a contact across leads, calls, and engagements.

| Feature | Description |
|---------|-------------|
| Person timeline | Full activity history (leads, deliveries, calls, dispositions) |
| Person leads | All leads associated with a person |
| Person calls | All calls for a person |
| Person notes | Internal notes attached to a contact |
| Merge | Merge duplicate person records |

## Sessions (Multi-Step Capture)

Sessions enable multi-step lead capture funnels. Partners collect data across multiple form steps, then submit on the final step.

**Flow:** Create session → PATCH data at each step → Submit on final step (triggers routing)

Sessions expire after 24 hours. Each PATCH merges data (doesn't replace). The lead is only created on final submit.

**Co-Registration (Coreg):** Submit the same contact through multiple campaigns in a single session. Primary lead submits first, then coreg leads are linked via `parentLeadId`.

## Engagements

Engagements track CPA-eligible events across leads. When a contract has CPA configured (cpaAmount + cpaWindowDays), the system monitors for conversion dispositions within the window.

## Consent

Consent verification accounts provide TCPA compliance tracking. Certificates document that consent was collected properly for each lead.

## Posting Log

The posting log records every lead submission and delivery attempt with full request/response payloads. Use it for:
- Debugging submission failures
- Verifying delivery payloads
- Troubleshooting integration issues
- Auditing partner submissions

## Onboarding

The `setup_partner_onboarding` tool provides a guided multi-step partner onboarding flow — creates the partner, campaign, and links to an offer in one workflow.

## Gotchas

1. **Vertical mismatch** — Campaign, contract, and offer must all reference the SAME vertical
2. **Posting key ≠ API key** — postingKey (lr_xxx on campaign) is for lead submission only
3. **Balance blocks routing** — buyer balance > creditLimit = all contracts skipped
4. **Caps reset in contract timezone** — not UTC
5. **Inactive cascades** — pausing buyer pauses all contracts; pausing offer can cascade to campaigns
6. **Dedup is per-buyer** — two buyers can both receive the same person
7. **Offer needs both sides** — campaigns without contracts = leads accepted, nowhere to route
8. **Empty schedule = 24/7** — if set, leads outside hours are rejected (not queued)
9. **State abbreviations** — geo filters use "CA" not "California"
10. **DQ contracts are separate** — linked via DQ Contracts tab, not regular Contracts tab
