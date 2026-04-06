---
name: partner-guide
description: "Partner guide for iSCALE lead routing — submitting leads, managing campaigns, posting specs, the partner portal, API keys, sessions, co-registration. Use when integrating lead submission, checking campaign status, or using the partner portal."
user_invocable: true
allowed_tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# iSCALE Partner Guide

Guide for partners (affiliates, publishers, lead generators) who submit leads into iSCALE. Covers lead submission, campaign management, the partner portal, and API integration.

## When to use
- Integrating lead submission into your system
- Understanding posting specs and required fields
- Managing campaigns in the partner portal
- Setting up API keys
- Using sessions for multi-step lead capture
- Setting up co-registration flows
- Checking lead status and payouts
- Troubleshooting rejected leads

## How Lead Submission Works

You submit leads to iSCALE via API. Each campaign has a unique **posting key** (`lr_xxx`) that identifies your campaign and authorizes the submission.

```
Your System → POST /api/v1/leads/submit → iSCALE Routing Engine → Buyer(s)
```

1. You submit a lead with the campaign's posting key
2. iSCALE validates the lead data against required fields
3. The routing engine evaluates which buyers want the lead
4. Lead is delivered to winning buyer(s)
5. You get paid based on your campaign's pricing (costPerLead or revshare)

## Submitting Leads

### Endpoint

```
POST /api/v1/leads/submit
Authorization: Bearer lr_xxx
Content-Type: application/json
```

Replace `lr_xxx` with your campaign's posting key.

### Required Fields (Every Lead)

| Field | Type | Description |
|-------|------|-------------|
| campaignId | string | Campaign UUID or display ID |
| firstName | string | Lead's first name |
| lastName | string | Lead's last name |
| email | string | Valid email address |
| phone | string | Phone number (digits only, 10 chars) |
| zipCode | string | 5-digit zip code |
| ipAddress | string | Lead's IP address |
| tcpaConsent | boolean | Must be `true` |
| trustedFormCertUrl | string | TrustedForm certificate URL |

### Optional Global Fields

| Field | Type | Description |
|-------|------|-------------|
| address | string | Street address |
| city | string | City |
| state | string | 2-letter state code ("CA", "TX") |
| dateOfBirth | string | YYYY-MM-DD format |
| sub1 — sub10 | string | Your tracking/sub-ID values |

### Vertical Fields

Each vertical (lead category) has additional required or optional fields. For example, a Solar vertical might require:

| Field | Type |
|-------|------|
| utilityBill | number |
| homeOwner | boolean |
| roofType | string |

### Campaign Fields

Some campaigns have additional fields beyond the vertical. Check the posting spec for the full list.

### Example Request

```json
{
  "campaignId": "abc-123",
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com",
  "phone": "5551234567",
  "zipCode": "90210",
  "state": "CA",
  "ipAddress": "203.0.113.42",
  "tcpaConsent": true,
  "trustedFormCertUrl": "https://cert.trustedform.com/abc123",
  "utilityBill": 150,
  "homeOwner": true,
  "sub1": "google",
  "sub2": "campaign-42"
}
```

### Response — Success

```json
{
  "data": {
    "id": "lead-uuid",
    "shortId": "L-12345",
    "status": "sold",
    "revenue": "15.00",
    "sales": [
      {
        "buyerId": "buyer-uuid",
        "price": "15.00",
        "deliveryStatus": "delivered"
      }
    ]
  }
}
```

### Response — Rejection

```json
{
  "data": {
    "id": "lead-uuid",
    "shortId": "L-12346",
    "status": "rejected",
    "rejectionReason": "No matching contracts"
  }
}
```

### Common Rejection Reasons

| Reason | What it means |
|--------|---------------|
| No matching contracts | No buyer contracts matched the lead's data |
| Duplicate lead | This person was already submitted recently |
| Cap exceeded | Campaign or buyer caps have been reached |
| Invalid field: [name] | A required field is missing or invalid |
| Campaign inactive | The campaign is paused or disabled |
| TCPA consent required | tcpaConsent must be `true` |
| Missing TrustedForm certificate | trustedFormCertUrl is required |

## Getting Your Posting Spec

The posting spec tells you exactly what fields to send for a specific campaign.

### Via API

```
GET /api/v1/campaigns/{campaignId}/posting
Authorization: Bearer lr_xxx
```

Returns:
```json
{
  "data": {
    "postingUrl": "https://leads.iscale.com/api/v1/leads/submit",
    "postingKey": "lr_xxx",
    "requiredFields": ["firstName", "lastName", "email", "phone", ...],
    "verticalFields": [...],
    "campaignFields": [...],
    "sampleBody": { ... }
  }
}
```

### Via Partner Portal

Go to **Campaigns > [Your Campaign] > Posting Specs tab**. This shows all fields, types, and a sample request body.

## Partner Portal

The partner portal gives you a dashboard to manage campaigns, view leads, and track payouts.

### Accessing the Portal

- **URL:** Your iSCALE instance URL + `/partner` (e.g., `https://leads.iscale.com/partner`)
- **Auth:** Login with your partner account credentials

### Portal Pages

| Page | What it shows |
|------|---------------|
| **Dashboard** | Overview stats — leads today, revenue, acceptance rate |
| **People** | Contacts across all your leads, with timeline |
| **Offers** | Available offers you can enroll in, plus your active campaigns |
| **Campaign Detail** | Overview, posting specs, leads for a specific campaign |
| **Payouts** | Payout history and upcoming payouts |
| **Posting Log** | Real-time log of every lead submission (success/failure) |
| **Settings** | Your profile, API keys |
| **Help** | Documentation and support |

### Viewing Leads

Go to **People > Leads tab** to see all submitted leads with:
- Status (sold, rejected, pending, returned)
- Revenue earned
- Submission date
- Campaign name

Click a lead to see full details including delivery status.

## API Keys

You can access the partner portal API programmatically using API keys.

### Creating an API Key

1. Go to **Settings** in the partner portal
2. Click **Create API Key**
3. Copy the key (shown once) — it starts with `lr_`

Or ask your admin to create one from the admin dashboard.

### Using API Keys

```
GET /api/partner/leads
Authorization: Bearer lr_your_partner_api_key
```

### Partner API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/partner/campaigns` | GET | List your campaigns |
| `/api/partner/campaigns/{id}` | GET | Campaign detail + posting spec |
| `/api/partner/campaigns/sync` | GET | Lightweight change detection |
| `/api/partner/leads` | GET | List your leads (filterable) |
| `/api/partner/leads/{id}` | GET | Lead detail |
| `/api/partner/offers` | GET | Available offers |
| `/api/partner/offers/{id}` | GET | Offer detail |
| `/api/partner/payouts` | GET | Payout history |
| `/api/partner/settings` | GET/PUT | Your profile |
| `/api/partner/api-keys` | GET/POST | List/create API keys |
| `/api/partner/api-keys/{id}` | DELETE | Revoke an API key |

## Sessions — Multi-Step Lead Capture

For multi-step funnels where you collect data across several pages, use the Sessions API.

### How It Works

1. **Create a session** — gets a session key
2. **PATCH data** at each step — add fields as the user fills them in
3. **Submit** on the final step — triggers routing

### Flow

```
Step 1: Create session (get sessionKey)
Step 2: PATCH { firstName, lastName, email }
Step 3: PATCH { phone, zipCode, utilityBill }
Step 4: Submit (triggers routing)
```

### Key Details

- Session key acts as a bearer token for subsequent requests
- Sessions expire after **24 hours**
- Each PATCH merges data — doesn't replace previous data
- Lead is only created on final submit

## Co-Registration (Coreg)

Submit the same contact through multiple campaigns in a single session.

### How It Works

1. Submit primary lead (normal flow)
2. Show coreg offers to the user (offers with `visibility: public`)
3. For each accepted offer, submit a coreg lead with the same contact data
4. Coreg leads are linked via `parentLeadId`

### Flow

```
Primary submit → Get coreg offers → Submit to each accepted offer → Close session
```

## Campaign Status

| Status | Meaning |
|--------|---------|
| `active` | Accepting leads |
| `paused` | Temporarily stopped — leads will be rejected |
| `inactive` | Disabled — no leads accepted |

If your campaign is paused or inactive, contact your admin.

## Pricing Models

| Model | How you get paid |
|-------|-----------------|
| `fixed` | Fixed costPerLead for every accepted lead |
| `revshare` | Percentage of revenue from buyer payments |

## Caps

Your campaign may have caps that limit volume:

| Cap | What it limits |
|-----|----------------|
| dailyCap | Max leads per day |
| weeklyCap | Max leads per week |
| monthlyCap | Max leads per month |

Caps reset at midnight in the campaign's timezone. Once hit, leads are rejected until the cap resets.

## Troubleshooting

### "Campaign inactive" rejection
Your campaign has been paused or disabled. Contact your admin.

### "Invalid field" rejection
A required field is missing or in the wrong format. Check the posting spec for field types and required flags.

### "Duplicate lead" rejection
This person (by email/phone) was already submitted recently. Each buyer has their own dedup window (typically 30 days).

### "No matching contracts" rejection
No buyer contracts matched the lead's data. This could mean:
- Lead's state/zip doesn't match any buyer's geo filters
- Lead's demographics don't match buyer requirements
- All eligible buyers have hit their caps
- All eligible buyers are paused or out of balance

### "Cap exceeded" rejection
Your campaign's daily/weekly/monthly cap has been reached. Wait for the cap to reset or ask your admin to increase it.

### Leads showing "pending" status
The lead was accepted but delivery to the buyer is still in progress. Check back shortly — it should update to "sold" or "failed".

### Not getting paid for leads
Check that:
- Leads have status "sold" (not "rejected" or "returned")
- Your payment cycle is set correctly
- Your balance reflects recent leads
