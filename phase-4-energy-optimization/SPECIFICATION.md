# Phase 4 — Energy Optimization

## Goal

Convert Phase 3 demand/generation forecasts into an explainable battery dispatch schedule that reduces expected grid imports and renewable curtailment while respecting battery constraints.

## Inputs

- Phase 3 forecast run containing 1–48 future demand and generation values.
- Battery capacity and initial state of charge.
- Charge and discharge efficiencies.
- User-defined relative cost weights for grid imports, curtailment, and battery throughput.

## Optimization model

Phase 4 uses `dp-storage-v1`, a deterministic dynamic-programming storage optimizer.

At each forecast step it chooses a feasible next battery state of charge. The schedule respects:

- battery capacity;
- initial SOC;
- charge efficiency;
- discharge efficiency;
- available generation surplus;
- current demand deficit.

The objective penalizes grid imports, curtailed energy, and battery throughput. A small terminal-SOC penalty discourages unnecessarily emptying the battery at the end of the horizon.

SOC is discretized to at most 120 states, making the optimizer bounded and predictable for the Phase 3 maximum 48-step horizon.

## Outputs

- step-by-step charge/discharge schedule;
- grid import per step;
- curtailment per step;
- battery SOC per step;
- aggregate energy totals;
- objective cost;
- optimizer model version and SOC resolution.

## Persistence and security

Optimization runs are persisted in `public.optimization_runs` with exact input/result snapshots. Access is restricted through Supabase RLS to the owning project user.

## API/UI

- `POST /api/optimization` runs and persists an optimization.
- `GET /api/optimization?projectId=...` lists project-owned optimization runs.
- `GET /api/forecast-runs?projectId=...` lists project-owned Phase 3 forecast runs for selection.
- `/dashboard/optimization` provides the Optimization Lab.

## Explicit non-goals

Phase 4 does not include autonomous control, inverter/IoT commands, real hardware integration, grid dispatch, electricity-market bidding, reinforcement learning, or automatic real-world actuation. Phase 5 begins the real-world pilot work.
