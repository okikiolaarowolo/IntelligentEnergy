# Phase 1 — Energy Simulator

## Purpose

Phase 1 is the first working technical system for IntelligentEnergy. It establishes a deterministic, testable energy simulation engine that models energy generation, consumption, battery storage, and energy balance over discrete time steps.

This phase is intentionally a simulation only. It does **not** include machine learning, a SaaS dashboard, autonomous control, real hardware control, or production infrastructure.

## Objectives

1. Represent an energy system with generation, demand, and battery storage.
2. Simulate the system over a sequence of time steps.
3. Track energy produced, consumed, stored, discharged, curtailed, and unmet.
4. Produce structured results that can be tested and visualized.
5. Make the simulator deterministic and reproducible.
6. Build a clean foundation for Phase 2 and later phases.

## Core model

For each time step `t`:

- `generation_t` = energy generated during the step (kWh)
- `demand_t` = energy demanded during the step (kWh)
- `battery_soc_t` = battery state of charge (kWh)
- `battery_capacity` = maximum stored energy (kWh)
- `charge_efficiency` = fraction of input energy retained when charging
- `discharge_efficiency` = fraction of battery energy delivered to the load

The simulator should apply a clearly documented dispatch order. The default Phase 1 order is:

1. Generation serves demand first.
2. Surplus generation charges the battery, subject to capacity and charge efficiency.
3. Remaining surplus is curtailed.
4. If generation is insufficient, the battery discharges subject to available state of charge and discharge efficiency.
5. Any remaining demand is recorded as unmet demand.

All units and sign conventions must be explicit in code and documentation.

## Required outputs

At minimum, each simulation result should expose, per time step:

- generation
- demand
- direct generation-to-load energy
- battery charge input
- battery discharge delivered to load
- curtailed energy
- unmet demand
- battery state of charge

The simulator should also provide useful aggregate metrics such as:

- total generation
- total demand
- total curtailed energy
- total unmet demand
- final battery state of charge
- renewable/self-supply fraction where the definition is explicitly documented

## Engineering requirements

- Use a modular design so the simulation engine is independent from visualization.
- Avoid hard-coded example data inside the core engine.
- Validate inputs and reject invalid physical parameters.
- Keep calculations deterministic.
- Use clear type hints and documentation.
- Include automated tests for normal operation and edge cases.
- Do not silently hide invalid values or simulation failures.
- Avoid unnecessary dependencies.

## Suggested initial implementation

Claude should inspect the repository and choose the simplest appropriate implementation language and tooling. For a Python implementation, a sensible starting structure is:

```text
phase-1-energy-simulator/
├── README.md
├── SPECIFICATION.md
├── src/
│   └── intelligent_energy/
├── tests/
└── data/
```

The implementation language should be justified before introducing it if the repository is otherwise empty.

## Minimum test scenarios

The test suite should cover at least:

1. Generation exactly equals demand.
2. Generation exceeds demand and the battery has room.
3. Generation exceeds demand and the battery is full.
4. Generation is below demand and the battery can cover the deficit.
5. Generation is below demand and the battery cannot cover the full deficit.
6. Empty battery with insufficient generation.
7. Zero generation.
8. Zero demand.
9. Invalid negative values and invalid efficiency/capacity parameters.
10. Conservation/accounting checks appropriate to the chosen efficiency model.

## Phase 1 boundaries

Do **not** implement yet:

- machine-learning prediction
- demand forecasting
- optimization algorithms beyond the deterministic dispatch rules defined here
- user authentication
- SaaS billing
- cloud database requirements
- autonomous real-world control
- hardware actuation
- grid-control interfaces

Those belong to later phases.

## Definition of Done

Phase 1 is complete only when:

- the simulator runs from a clean checkout;
- the core simulation logic is separated from presentation;
- automated tests pass;
- edge cases are covered;
- energy accounting is internally consistent;
- a reproducible example scenario is documented;
- results can be exported or inspected in a structured form;
- documentation explains assumptions, equations, units, and limitations;
- no future-phase functionality has been disguised as completed functionality.
