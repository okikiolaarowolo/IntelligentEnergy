# Phase 2 — Technical Specification

## 1. Scope

Phase 2 is the SaaS/application layer built around the Phase 1 deterministic energy simulator.

The application must provide authentication, user-owned projects, saved scenarios, simulation execution, persistence, and result visualization.

The Phase 1 simulator remains the authoritative implementation of energy dispatch and accounting rules.

## 2. Recommended stack

Use a conventional web stack that minimizes unnecessary infrastructure. A reasonable default is:

- Frontend/application: Next.js + TypeScript
- Authentication/database: Supabase
- Deployment: Vercel-compatible deployment
- Simulation engine: the existing Phase 1 implementation

Claude may choose a different stack if the repository already contains a better foundation, but any deviation should be justified before implementation.

Do not introduce multiple competing frameworks or databases without a concrete reason.

## 3. Application layers

### Presentation layer

Responsible for:

- authentication screens
- project/scenario pages
- forms
- dashboards
- charts/tables
- loading and error states

It must not implement a second copy of the simulation algorithm.

### Application/API layer

Responsible for:

- authentication/session checks
- authorization
- request validation
- project/scenario CRUD
- invoking the simulation engine
- persistence of runs/results
- returning structured responses

### Simulation layer

Responsible for invoking the Phase 1 simulator with validated inputs.

The Phase 2 application must not silently alter simulation parameters or reinterpret the Phase 1 accounting conventions.

### Persistence layer

Responsible for storing users/projects/scenarios/runs and retrieving only authorized records.

## 4. Database model

A minimum relational design should include:

### projects

- id
- owner_user_id
- name
- description (nullable)
- created_at
- updated_at

### scenarios

- id
- project_id
- name
- generation_profile
- demand_profile
- battery_capacity_kwh
- initial_soc_kwh
- charge_efficiency
- discharge_efficiency
- created_at
- updated_at

Profiles may be stored using a structured database type such as JSON/JSONB if appropriate, but the schema must validate their shape before simulation.

### simulation_runs

- id
- scenario_id
- status
- simulator_version or equivalent reproducibility identifier
- input_snapshot
- result_snapshot
- created_at
- completed_at (nullable)
- error information where appropriate

Storing an input snapshot is important because a scenario may be edited after a run. Historical runs must remain reproducible and auditable.

## 5. Authorization model

Ownership chain:

```text
User → Project → Scenario → Simulation Run
```

Every read, update, and delete must verify ownership through this chain.

If Supabase is used, Row Level Security should be enabled for user-owned tables and policies should enforce ownership. Do not rely solely on frontend route protection.

## 6. Simulation API contract

The application should expose a clear internal/server-side operation equivalent to:

```text
runSimulation(scenarioInput) → simulationResult
```

The operation must:

1. authenticate the caller;
2. authorize access to the scenario/project;
3. validate the scenario input;
4. execute the Phase 1 simulator;
5. persist the run and structured result;
6. return the run/result identifier and summary data.

For the initial implementation, synchronous execution is acceptable for small profiles. Do not introduce background queues unless there is a demonstrated need.

## 7. Validation

At the application boundary, reject:

- missing required fields;
- negative generation/demand values;
- negative battery capacity;
- initial SOC outside `[0, capacity]`;
- efficiencies outside `(0, 1]`;
- generation and demand profiles of different lengths;
- malformed profile values;
- non-finite numeric values where the selected stack permits them.

The server must validate independently of frontend validation.

## 8. Results dashboard

At minimum display:

- total generation;
- total demand;
- total curtailed energy;
- total unmet demand;
- final battery SOC;
- direct generation-to-load energy;
- battery discharge delivered;
- time-series generation vs demand;
- battery SOC over time;
- a readable per-step results table.

Charts are presentation only. Their data must come from stored structured simulation results.

## 9. Reproducibility

A completed run must retain:

- exact input profile;
- exact battery parameters;
- simulator version/identifier;
- resulting outputs;
- execution timestamp.

If the simulation engine changes later, historical runs must not falsely appear to have been produced by the newer engine.

## 10. Error handling

Use explicit states such as:

- pending (only if asynchronous execution is introduced);
- running (only if required);
- completed;
- failed.

Failed runs should expose a safe user-facing error while retaining useful server-side diagnostic information. Never expose secrets, stack traces, or internal credentials to users.

## 11. Testing requirements

At minimum test:

1. authentication/session behavior;
2. unauthenticated access rejection;
3. project creation/read/update/delete;
4. cross-user project access rejection;
5. scenario ownership enforcement;
6. invalid simulation input rejection;
7. successful Phase 1 integration;
8. persistence of simulation inputs and outputs;
9. historical run immutability/reproducibility expectations;
10. dashboard handling of successful and failed runs.

The Phase 1 test suite must continue to pass unchanged unless a genuine integration issue requires a documented update.

## 12. Phase 2 boundaries

Do not add:

- ML models;
- forecasting;
- optimization engines;
- autonomous control;
- hardware APIs;
- IoT device control;
- grid dispatch;
- advanced enterprise billing;
- speculative AI features that are not required for the SaaS foundation.

## 13. Security checklist

Before declaring Phase 2 complete:

- no secrets committed to the repository;
- authentication is enforced server-side;
- authorization is enforced for every user-owned resource;
- database policies prevent cross-user access;
- client cannot directly bypass authorization;
- all external/user input is validated;
- error responses do not leak sensitive implementation details;
- production configuration is documented without exposing credentials.

## 14. Definition of Done

A clean checkout should allow the documented application setup to run. A user should be able to sign in, create a project, create a scenario, run a Phase 1 simulation, save the run, and inspect the results. Another user must not be able to access those records.

Phase 2 is not complete if the UI exists but the simulator is duplicated in frontend code, persistence is missing, authorization is missing, or tests do not cover the critical paths.
