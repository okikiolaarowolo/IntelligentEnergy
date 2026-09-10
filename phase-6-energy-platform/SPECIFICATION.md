# Phase 6 — Energy Platform

## Goal

Turn the Phase 2–4 energy engines into a reusable developer platform. External software can call the deterministic simulator, forecasting engine, and storage optimizer through authenticated project-scoped API keys without exposing the Supabase database directly.

## Included

- Project-scoped API key creation and revocation.
- API secrets are shown once and stored only as SHA-256 hashes.
- Authenticated platform endpoints:
  - `POST /api/v1/simulate`
  - `POST /api/v1/forecast`
  - `POST /api/v1/optimize`
- Per-key rolling 24-hour request limit of 1,000 requests.
- Usage records for endpoint, status code, project, and timestamp.
- Developer Platform dashboard for key management.
- Existing project ownership and RLS remain the control plane for dashboard users.

## Security model

Dashboard key management uses the authenticated Supabase session and existing project ownership policies. Platform requests use a server-only Supabase service-role client solely to validate the hashed API key and record platform usage. The service-role key must never be exposed to the browser.

API keys are project-scoped. The platform endpoints do not expose project rows, scenarios, or database credentials; they only execute the selected deterministic computation on request data.

## API authentication

```http
Authorization: Bearer ie_live_...
```

The secret is returned only at creation time. The database stores `SHA-256(secret)` and a short display prefix.

## Rate limiting

Each key has a 1,000-request rolling 24-hour limit. Responses include:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

This is an application-level limit for Phase 6, not a billing system.

## Non-goals

- Payment processing or subscriptions.
- Electricity-market transactions.
- Autonomous control.
- Hardware/inverter commands.
- IoT device management.
- Grid dispatch.
- Production billing guarantees.
- Guaranteed SLA or enterprise compliance claims.

## Required deployment configuration

Production must define `SUPABASE_SERVICE_ROLE_KEY` as a server-only environment variable in addition to the existing Supabase URL and publishable/anon key. Never place the service-role key in `NEXT_PUBLIC_*` variables.
