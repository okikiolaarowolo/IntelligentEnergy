# IntelligentEnergy

IntelligentEnergy is an energy-management SaaS prototype for investigating electricity demand, generation, storage scenarios, and possible inefficiencies. The competition MVP focuses on evidence-first energy investigation for schools and small businesses, with Nigerian grid, generator, inverter, and solar realities as a potential differentiator.

## Current implementation

The existing application includes:
- Next.js + TypeScript web application
- Supabase authentication and row-level security
- User-owned projects, scenarios, datasets, forecast runs, optimization runs, and pilot evaluations
- Deterministic energy simulator (`simulator-v1`)
- Deterministic forecasting (`ar-ridge-v1`) with held-out evaluation and naive baseline comparison
- Deterministic battery optimization (`dp-storage-v1`)
- Real-world CSV pilot data import and data-quality checks
- Historical-profile pilot evaluation with explicit assumptions and limitations
- Project-scoped developer API keys, usage auditing, and rolling rate limits
- Explainable advisory recommendations (`decision-v1`) and Decision Center at `/dashboard/decisions`
- Energy Investigator prototype at `/dashboard/investigator`, with structured findings, evidence, recommendations, assumptions, and limitations
- Unit tests for residual grid import, renewable surplus, peak demand, data-quality warnings, clean scenarios, and invalid inputs

The dashboard now supports a deterministic rule-based investigation and an optional authenticated LLM tool-calling endpoint at `POST /api/energy-investigator/agent`. The endpoint requires a signed-in Supabase user and a server-side `AI_GATEWAY_API_KEY` (recommended) or `OPENAI_API_KEY`; optional settings are `AI_GATEWAY_BASE_URL` and `ENERGY_AGENT_MODEL`. The default model is `openai/gpt-4o-mini`. It runs a bounded tool-calling loop against deterministic optimizer/investigator outputs. The initial verifier checks that findings cite result IDs from the current run, but it is not yet a complete semantic or numeric audit of every natural-language claim. Complete source-level Nigerian generator/fuel analysis and end-to-end benchmark results remain future work.

## Competition MVP

The focused MVP story: a school or small business supplies a clearly labelled energy dataset; IntelligentEnergy validates it, investigates supported patterns, runs deterministic analysis/optimization tools, and returns an evidence-backed advisory report. Candidate finding types are generator overuse, overnight baseload, peak demand, solar surplus/curtailment, and data-quality issues. The current input model does not yet support all of these end to end; see the evaluation plan for required extra fields and boundaries.

### Evidence and financial claims
- Findings must cite values from supplied data or deterministic tool results.
- The LLM, when integrated, must not do energy arithmetic.
- Naira savings can only be estimated when applicable tariffs, fuel prices, generator consumption, and source-allocation assumptions are supplied and shown.
- Simulated savings are not measured or guaranteed customer savings.
- The system is advisory only; it does not control batteries, inverters, IoT devices, or the grid.

## Competition development documents
- [Agent tool contracts and target loop](docs/energy-investigation-tool-contracts.md)
- [Synthetic planted-fault evaluation set](docs/energy-investigation-evaluation.md)
- [Competition agent plan](docs/competition-agent-plan.md)

## Setup
1. Install dependencies with `npm install`.
2. Configure Supabase and the environment variables in `.env.local`.
3. Apply migrations in `supabase/migrations/` in order, including `007_phase7_decision_layer.sql`.
4. To enable the AI-agent button, add `AI_GATEWAY_API_KEY` as a server-side deployment environment variable (never prefix it with `NEXT_PUBLIC_`). If needed, set `ENERGY_AGENT_MODEL` to a supported model.
5. Run `npm run dev`.

For the developer API, `SUPABASE_SERVICE_ROLE_KEY` must remain server-side and must never use a `NEXT_PUBLIC_` prefix.
