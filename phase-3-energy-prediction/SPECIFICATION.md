# Phase 3 — Energy Prediction

## Goal
Turn historical energy observations into evaluated short-horizon forecasts for demand and solar generation. Phase 3 is predictive analytics only; it does not control equipment or optimize dispatch.

## Scope
- Store user-owned historical energy datasets.
- Validate timestamps and non-negative finite generation/demand observations.
- Train a deterministic autoregressive ridge-regression model using lagged observations.
- Evaluate chronologically on a held-out test set before producing future forecasts.
- Report MAE, RMSE, MAPE, naive last-value baseline MAE, and improvement versus baseline.
- Forecast demand, generation, or both for 1–48 future steps.
- Persist exact input and result snapshots for reproducibility.
- Keep the model in a separate library from the Phase 1 simulator.
- Enforce Supabase RLS ownership through project → dataset → forecast run.

## Model
`ar-ridge-v1` uses lagged target values as features. A small ridge penalty stabilizes the closed-form linear regression. The test split is chronological (latest 20% of observations, with a minimum of three test samples) to avoid leaking future information into training.

The naive baseline predicts each test point as the immediately preceding observed value. Forecasts are generated recursively after fitting on the full historical series.

## Data contract
CSV/UI columns:
- `timestamp` — ISO-8601 timestamp
- `generation_kwh` — non-negative finite energy generated in each interval
- `demand_kwh` — non-negative finite energy consumed in each interval

At least 12 observations are required. Timestamps must be unique.

## Security
- All API requests require an authenticated Supabase user.
- Project ownership is checked server-side.
- Forecast datasets and runs use RLS ownership policies.
- Browser input is never treated as proof of ownership.
- Exact input/result snapshots are stored with each forecast run.

## Explicit non-goals
- No autonomous control.
- No battery dispatch optimization.
- No grid control.
- No hardware/IoT integration.
- No pricing/billing.
- No claims that a model is production-grade solely from a small user dataset.

## Definition of done
- Forecasting engine has automated tests.
- Forecast API authenticates and persists datasets/runs.
- Prediction Lab accepts historical data and shows evaluation metrics plus forecasts.
- Build, typecheck, lint, and tests pass.
- Phase 2 simulator remains the authoritative deterministic physics engine.
