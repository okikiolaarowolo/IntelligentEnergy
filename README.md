# IntelligentEnergy

IntelligentEnergy is an energy-management SaaS prototype that progresses from deterministic simulation to forecasting, battery optimization, pilot evaluation, developer APIs, and explainable decision support.

## Current implementation

**Phase 7 — Explainable Decision Layer** is implemented on `main`.

### Product flow
1. **Understand** — import historical demand/generation data.
2. **Predict** — generate deterministic demand/generation forecasts.
3. **Optimize** — compute a constrained battery schedule.
4. **Evaluate** — compare optimized historical-profile performance with a direct-renewable baseline.
5. **Recommend** — turn forecast/optimization outputs into explainable advisory recommendations.

### Included
- Next.js + TypeScript web application
- Supabase authentication and row-level security
- User-owned projects, scenarios, datasets, forecast runs, optimization runs, and pilot evaluations
- Deterministic energy simulator (`simulator-v1`)
- Deterministic forecasting (`ar-ridge-v1`) with held-out evaluation and naive baseline comparison
- Deterministic battery optimization (`dp-storage-v1`)
- Real-world CSV pilot data import and quality checks
- Historical-profile pilot evaluation with explicit assumptions and limitations
- Project-scoped developer API keys, usage auditing, and rolling rate limits
- Phase 7 explainable decision engine (`decision-v1`)
- Decision history persisted with project ownership enforced by RLS
- Decision Center at `/dashboard/decisions`

## Phase 7 boundary

The decision layer is **advisory only**. It does not directly control batteries, inverters, IoT devices, or the electrical grid. Recommendations are generated from supplied forecast/optimization outputs and clearly expose limitations.

Pilot evaluation is a historical-profile feasibility study, not an out-of-sample forecast backtest. Reported savings should therefore be presented as scenario estimates rather than guaranteed real-world savings.

## Setup

1. Install dependencies with `npm install`.
2. Configure Supabase and the environment variables in `.env.local`.
3. Apply the migrations in `supabase/migrations/` in order, including `007_phase7_decision_layer.sql`.
4. Run `npm run dev`.

For the developer API, `SUPABASE_SERVICE_ROLE_KEY` must remain server-side and must never use a `NEXT_PUBLIC_` prefix.
