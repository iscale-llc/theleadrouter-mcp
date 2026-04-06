---
name: buyer-guide
description: "Buyer guide for iSCALE lead routing — managing contracts, filters, caps, delivery, dedup, balance, returns, dispositions, the buyer portal. Use when configuring how you receive leads, troubleshooting delivery, or managing your buyer account."
user_invocable: true
allowed_tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# iSCALE Buyer Guide

Guide for buyers (advertisers, clients, law firms, agencies) who purchase leads from iSCALE. Covers contracts, filters, delivery, dedup, billing, returns, and the buyer portal.

## When to use
- Setting up or modifying how you receive leads
- Configuring filters (geo, demographic, custom)
- Setting caps and schedules
- Configuring delivery to your CRM or endpoint
- Understanding dedup and how duplicates are handled
- Managing balance and billing
- Returning leads or handling dispositions
- Using the buyer portal
- Troubleshooting delivery issues

## How You Receive Leads

Partners submit leads → the routing engine evaluates your contracts → if your filters match, the lead is delivered to your endpoint.

```
Lead submitted → Routing Engine checks your contract → Filters pass? → Caps ok? → No dupe? → Delivered to you
```

You only pay for leads that pass all checks and are successfully delivered.

## Contracts — Your Lead Agreements

A contract defines exactly what leads you want, how many, at what price, and where to deliver them. You can have multiple contracts for different verticals or different criteria within the same vertical.

### Key Contract Settings

**What leads you want:**

| Setting | Purpose | Example |
|---------|---------|---------|
| verticalId | Lead category | Solar, Medicare, Auto Insurance |
| geoFilters | Geographic restrictions | Only leads from CA, TX, FL |
| demographicFilters | Age/gender requirements | Age 25-65 |
| customFilters | Vertical-specific criteria | homeOwner = true, utilityBill > $100 |

**How many:**

| Setting | Purpose |
|---------|---------|
| dailyLeadCap | Max leads per day |
| weeklyLeadCap | Max leads per week |
| monthlyLeadCap | Max leads per month |
| dailySpendCap | Max spend per day |
| weeklySpendCap | Max spend per week |
| monthlySpendCap | Max spend per month |

**At what price:**

| Setting | Purpose |
|---------|---------|
| pricingModel | `fixed` (set price) or `ping_post` (bid per lead) |
| pricePerLead | Amount you pay per lead |
| exclusiveMultiplier | Price multiplier for exclusive leads (default: 1.0) |
| allowMultiSale | Whether you accept shared/multisell leads |

**When:**

| Setting | Purpose |
|---------|---------|
| scheduleTimezone | Your timezone (default: America/Los_Angeles) |
| scheduleHours | Operating hours per day of week |
| expiresAt | Contract end date |

Empty scheduleHours = leads delivered 24/7. If hours are set, leads outside your hours are rejected (not queued for later).

## Filters — Controlling What You Receive

### Geographic Filters

```json
{
  "states": ["CA", "TX", "FL"],
  "zipCodes": ["902*", "100*", "330*"]
}
```

- States use 2-letter abbreviations ("CA" not "California")
- Zip codes support wildcards ("902*" matches 90201-90299)
- Leave empty to accept all locations

### Demographic Filters

```json
{
  "minAge": 25,
  "maxAge": 65
}
```

### Custom Filters (Vertical-Specific)

These depend on the vertical. Examples for Solar:

```json
{
  "homeOwner": true,
  "utilityBill": { "min": 100 }
}
```

### How Filters Are Evaluated

All filters must pass for a lead to reach you. If any filter fails, the lead is rejected for your contract (but may still go to other buyers).

Order of evaluation:
1. Contract status active?
2. Your account status active?
3. Your balance within credit limit?
4. Within your schedule hours?
5. Geo filters match?
6. Demographic filters match?
7. Custom filters match?
8. Caps not exceeded?
9. Dedup check passed?

## Delivery — How Leads Reach You

Leads are delivered to your system via the method configured on your contract or intake center.

### Delivery Methods

| Method | Description |
|--------|-------------|
| `http_post` | POST JSON to your endpoint |
| `http_get` | GET request with data as query params |
| `email` | Lead data sent via email |

### Delivery Configuration

**On the contract directly:**
- `deliveryUrlOverride` — your endpoint URL
- `deliveryMethodOverride` — POST, GET, or email
- `deliveryConfig` — field mapping, custom headers, auth

**Via Intake Center (recommended for CRM integration):**
- Link your contract to an intake center
- Intake center defines delivery URL, auth, field mapping
- Multiple contracts can share the same intake center

### Delivery Config Example

```json
{
  "url": "https://your-crm.com/api/leads",
  "method": "POST",
  "headers": {
    "X-API-Key": "your-key"
  },
  "fieldMapping": {
    "first_name": "{{firstName}}",
    "last_name": "{{lastName}}",
    "email_address": "{{email}}",
    "phone_number": "{{phone}}"
  }
}
```

### Delivery Statuses

| Status | Meaning |
|--------|---------|
| `pending` | Waiting to be delivered |
| `delivering` | Delivery in progress |
| `delivered` | Successfully delivered to your endpoint |
| `failed` | Delivery failed (will retry) |
| `returned` | Lead was returned (refunded) |

## Dedup — Duplicate Prevention

Dedup prevents you from receiving the same person twice within a time window.

### How It Works

1. When a lead is routed to you, iSCALE hashes the dedup fields (default: email + phone)
2. Checks if that hash exists in your dedup history within the window
3. If found → lead is rejected as duplicate for your contract
4. If not found → lead is delivered, hash is stored

### Settings

| Setting | Default | Purpose |
|---------|---------|---------|
| dedupEnabled | false | Turn on duplicate checking |
| dedupFields | ["email", "phone"] | Which fields to check |
| dedupWindowDays | 30 | How many days to remember |

### Important Notes

- Dedup is **per-buyer** — if you and another buyer both have contracts, you can both receive the same person
- Cross-partner dedup (same person from different partners) is configured at the **offer level**, not the buyer level
- Dedup records expire after `dedupWindowDays` — after that, the same person can be sent again

## Balance & Billing

### How Balance Works

- Your **balance** increases each time you receive a lead (you owe more)
- Your **creditLimit** is the maximum you can owe before leads stop routing to you
- When balance >= creditLimit, all your contracts are skipped during routing

### Balance Fields

| Field | Purpose |
|-------|---------|
| balance | Current amount owed |
| creditLimit | Max allowed balance |
| autoRecharge | Automatically add funds? |
| autoRechargeAmount | How much to add |
| autoRechargeThreshold | Balance level that triggers recharge |

### If Leads Stop Coming

Check your balance — if it's at or near your credit limit, that's why. Either make a payment (reduces balance) or ask your admin to increase the credit limit.

## Returns

You can return leads within the return window if they don't meet quality standards.

### How Returns Work

1. You identify a low-quality lead
2. Submit a return request with the lead ID and reason
3. If within the return window, the lead is refunded
4. Your balance is reduced by the lead's price
5. The partner's balance is also adjusted

### Return via API

```
POST /api/buyer/leads/{leadId}/return
Authorization: Bearer lr_your_buyer_api_key

{
  "reason": "Invalid phone number"
}
```

## Dispositions

Dispositions track what happened to a lead after delivery — did the buyer close the deal? Did the lead answer the phone?

### How Dispositions Work

1. Lead is delivered to you
2. You process the lead in your CRM
3. You send back a disposition (status update) via postback or API
4. iSCALE records the disposition and may trigger CPA payments

### Common Dispositions

| Disposition | Meaning |
|-------------|---------|
| contacted | Lead was contacted |
| qualified | Lead is qualified |
| converted | Lead became a customer (triggers CPA if configured) |
| not_interested | Lead declined |
| bad_data | Data was incorrect |
| duplicate | You already had this person |

### CPA (Cost Per Acquisition)

If your contract has CPA configured:
- **cpaAmount:** Bonus payment triggered when lead converts
- **cpaWindowDays:** Days to wait for conversion before expiring
- When you send a "converted" disposition within the window, the CPA payment is processed

## Intake Centers — CRM Integration

An intake center represents your CRM or backend system. It centralizes delivery config so multiple contracts can share it.

### What Intake Centers Provide

| Feature | Purpose |
|---------|---------|
| Delivery config | URL, auth, method — shared across contracts |
| Disposition mapping | Your CRM status codes → iSCALE dispositions |
| Program cascades | Your program codes → specific contracts |

### Disposition Mapping Example

Your CRM returns status codes like "SOLD", "DNC", "CALLBACK". The intake center maps these:

| Your CRM Code | iSCALE Disposition |
|---------------|-------------------|
| SOLD | converted |
| DNC | not_interested |
| CALLBACK | contacted |
| BAD_NUM | bad_data |

## Buyer Portal

The buyer portal gives you a dashboard to view your leads, track spending, and manage settings.

### Accessing the Portal

- **URL:** Your iSCALE instance URL + `/buyer` (e.g., `https://leads.iscale.com/buyer`)
- **Auth:** Login with your buyer account credentials

### What You Can See

| Section | Information |
|---------|-------------|
| Dashboard | Today's leads, spending, cap utilization |
| Leads | All leads received, with status and delivery info |
| Contracts | Your active contracts and their settings |
| Transactions | Financial history — charges, credits, payments |
| Settings | Account profile, API keys |

### Buyer API Keys

Create API keys in Settings to access the buyer API programmatically.

```
GET /api/buyer/leads
Authorization: Bearer lr_your_buyer_api_key
```

## Ping-Post (Auction Model)

If your contract uses ping-post pricing, here's how it works:

1. **Ping:** iSCALE sends you lead attributes (no PII — just vertical data, geo, demographics)
2. **You bid:** Return a bid price (or decline)
3. **Post:** If you win the auction, iSCALE delivers the full lead with PII
4. **You pay:** The bid price, not the contract's fixed price

### Ping Request (What You Receive)

```json
{
  "pingId": "abc-123",
  "vertical": "solar",
  "state": "CA",
  "zipCode": "90210",
  "homeOwner": true,
  "utilityBill": 150
}
```

### Your Bid Response

```json
{
  "pingId": "abc-123",
  "bid": 25.00,
  "accepted": true
}
```

Or to decline:
```json
{
  "pingId": "abc-123",
  "accepted": false
}
```

## Troubleshooting

### Not receiving any leads
1. Check your account status is `active`
2. Check your balance hasn't exceeded creditLimit
3. Check your contracts are `active`
4. Check your contracts are linked to an offer
5. Check filter settings aren't too restrictive
6. Check schedule — are you within operating hours?

### Receiving leads you don't want
1. Tighten your geo filters (add specific states/zips)
2. Add demographic filters
3. Add custom filters for vertical-specific criteria
4. Contact your admin to adjust contract settings

### Delivery failures
1. Check your delivery URL is correct and accepting requests
2. Check auth configuration matches your endpoint
3. Check your endpoint is returning 200 status codes
4. Review delivery response in lead detail for error messages

### Duplicate leads
1. Enable dedupEnabled on your buyer account
2. Set dedupFields to the fields you want to check (default: email + phone)
3. Set dedupWindowDays to your preferred lookback window
4. Note: dedup only prevents duplicates to YOUR account — other buyers may still get the same person

### Balance too high
1. Make a payment to reduce your balance
2. Ask your admin to increase your creditLimit
3. Consider enabling autoRecharge to automatically fund your account
