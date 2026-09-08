# IntelligentEnergy

IntelligentEnergy is being developed in controlled phases from deterministic energy simulation toward prediction, optimization, and eventually autonomous energy management.

## Current implementation

**Phase 2 — Energy SaaS** is implemented on branch `phase-2-energy-saas`.

### Included
- Next.js + TypeScript web application
- Supabase email authentication/session handling
- User-owned projects
- Scenario creation and simulation API
- Reusable deterministic Phase 1 simulation engine
- Supabase persistence for scenarios and simulation runs
- Row Level Security policies for project → scenario → run ownership
- Results dashboard with aggregate metrics and time-step data
- Vitest tests for core simulation behavior

### Setup

1. Install dependencies with `npm install`.
2. Create a Supabase project.
3. Apply `supabase/migrations/001_phase2_schema.sql` in the Supabase SQL editor.
4. Copy `.env.example` to `.env.local` and add the Supabase URL and anon key.
5. Run `npm run dev`.

The service never accepts a browser-supplied user ID as an ownership authority; authenticated Supabase sessions and RLS are the security boundary.

## Phase boundaries

Phase 2 does **not** include machine-learning prediction, forecasting, advanced optimization, autonomous control, IoT/hardware control, grid-control interfaces, or billing.

Before Phase 3 starts, Phase 2 should be tested with a configured Supabase project and reviewed for build, lint, auth, RLS, persistence, and simulation correctness.
