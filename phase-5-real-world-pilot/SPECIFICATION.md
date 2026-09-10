# Phase 5A — Real-World Data Import & Pilot Foundation

## Goal

Turn real or historical energy measurements into a validated, traceable pilot dataset that can be evaluated against the existing prediction and optimization pipeline.

Phase 5A establishes the baseline. It does **not** claim energy savings until a real dataset has been evaluated through the later prediction and optimization stages.

## Accepted input

CSV with exactly these headers:

```csv
timestamp,demand_kwh,generation_kwh
```

Rules:

- minimum 12 observations;
- maximum 10,000 observations;
- maximum upload size 5 MB;
- timestamps must parse as valid datetimes;
- timestamps must be unique and strictly increasing after normalization;
- observations must use a consistent sampling interval;
- demand and generation must be finite and non-negative.

## Persistence

### `pilot_datasets`

Stores dataset-level provenance and the computed pre-optimization baseline:

- project ownership;
- dataset name;
- source filename;
- observation count;
- start/end timestamps;
- sampling interval;
- baseline metrics;
- creation timestamp.

### `pilot_observations`

Stores normalized observations:

- dataset ID;
- timestamp;
- demand kWh;
- generation kWh.

Both tables use Supabase RLS through the existing `project.owner_user_id` ownership chain.

## Baseline calculations

For every time step, before storage optimization:

- direct renewable-to-load = `min(generation, demand)`;
- grid import = `max(demand - generation, 0)`;
- curtailed renewable energy = `max(generation - demand, 0)`.

The dataset dashboard reports:

- total demand;
- total generation;
- direct renewable supply;
- grid import;
- curtailment;
- renewable utilization;
- grid dependency;
- average demand/generation;
- peak demand/generation.

These values are the baseline against which later optimization results can be compared.

## Forecast handoff

The pilot dataset can be promoted into the existing Phase 3 `forecast_datasets` table. The handoff preserves the normalized timestamps and energy measurements and allows Prediction Lab to run the existing deterministic `ar-ridge-v1` model.

## API

- `GET /api/pilot/datasets?projectId=...`
- `POST /api/pilot/datasets` — multipart CSV import
- `GET /api/pilot/datasets/:id` — dataset plus observations
- `DELETE /api/pilot/datasets/:id`
- `POST /api/pilot/datasets/:id` with `{ "action": "create-forecast-dataset" }`

All endpoints require an authenticated user and enforce project ownership through Supabase RLS and explicit project checks.

## UI

`/dashboard/pilot`

The dashboard provides:

1. CSV import and validation;
2. dataset history;
3. baseline metrics;
4. historical demand/generation visualization;
5. data-quality confirmation;
6. handoff to Prediction Lab;
7. deletion of pilot datasets.

## Security and scope boundaries

- No service-role key is exposed to the browser.
- No automatic hardware control is implemented.
- No inverter commands are sent.
- No grid dispatch or market bidding is implemented.
- No claim of financial savings is made from the import alone.
- Imported data remains scoped to the authenticated user's project.

## Next stage

Phase 5B should compare a real pilot's baseline against forecast-driven optimization using common assumptions for battery constraints and energy tariffs, then report measured/estimated energy and cost differences with the underlying assumptions visible.
