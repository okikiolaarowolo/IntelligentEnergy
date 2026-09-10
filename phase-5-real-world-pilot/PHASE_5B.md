# Phase 5B — Pilot Evaluation

## Goal
Compare the Phase 5A pre-optimization baseline with a constrained battery optimization of the same historical profile, while making every assumption visible.

## Outputs
- grid-import reduction (kWh and percent);
- curtailment reduction (kWh and percent);
- renewable utilization;
- battery charge/discharge throughput;
- estimated baseline and optimized energy cost;
- estimated cost difference and percent difference.

## Important interpretation
This implementation uses the historical demand/generation profile as the optimizer input. It is therefore a **historical-profile optimization / feasibility study**, not a forecast backtest. It may represent an optimistic upper bound because the optimizer sees the actual profile it is evaluating.

The next rigorous validation should use a forecast generated without future actuals for the dispatch decision, then score that schedule against the held-out actual observations.

## Assumptions
The user supplies battery capacity, initial SOC, charge/discharge efficiencies, grid-import tariff, curtailment cost, and battery-throughput cost. These assumptions are persisted with each evaluation so results remain reproducible.

## Safety and scope
The evaluation is software-only. It sends no inverter commands, controls no hardware, performs no grid dispatch, and does not guarantee financial savings.
