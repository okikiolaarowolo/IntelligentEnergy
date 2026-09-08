# Phase 2 — Energy SaaS

## Purpose

Phase 2 turns the validated Phase 1 energy simulator into a usable web application. The goal is to provide a clean interface where users can create accounts, manage energy projects/scenarios, run simulations using the Phase 1 engine, and inspect their results.

Phase 2 is an application/product layer around the simulator. The core simulation rules remain deterministic and must not be rewritten merely to fit the UI.

## Objectives

1. Provide secure user authentication.
2. Allow users to create and manage energy projects.
3. Allow users to create, save, edit, duplicate, and delete simulation scenarios.
4. Allow users to enter generation, demand, and battery parameters/profile data.
5. Run Phase 1 simulations through a server-side application boundary.
6. Store simulation inputs and results in a persistent database.
7. Present simulation results through a clear dashboard.
8. Preserve reproducibility by storing the exact inputs/configuration used for each run.
9. Establish clean interfaces for future prediction and optimization phases.

## Product boundary

Phase 2 should provide the first real IntelligentEnergy SaaS experience, but it is not yet an AI prediction or optimization product.

### Build now

- Web application
- Authentication
- User/session management
- Project management
- Scenario management
- Simulation configuration forms
- Phase 1 simulator integration
- Persistent storage
- Simulation history
- Results dashboard
- Basic charts/tables for simulation results
- Input validation and useful error messages
- Basic application tests

### Do not build yet

- Machine-learning prediction
- Demand forecasting
- Advanced optimization
- Autonomous decisions
- Real-time hardware control
- IoT/device integrations
- Grid-control interfaces
- Complex billing/payment infrastructure
- Multi-tenant enterprise administration beyond what is necessary for secure user-owned data

## Core user flow

1. User creates an account or signs in.
2. User creates an energy project.
3. User creates a simulation scenario inside the project.
4. User enters or uploads generation and demand profiles and battery configuration.
5. Application validates the configuration.
6. Application runs the Phase 1 simulator.
7. Application stores the simulation inputs, configuration, and results.
8. User views summary metrics and time-series results.
9. User can return later to inspect previous runs or create a new scenario.

## Suggested architecture

Keep responsibilities separated:

```text
Web UI
  ↓
Application/API layer
  ↓
Simulation service
  ↓
Phase 1 simulation engine

Application/API layer
  ↕
Database
```

The UI must not contain the authoritative energy-dispatch calculations. The Phase 1 engine remains the source of truth for simulation behavior.

## Data concepts

The implementation should have clear models for at least:

### User

Authenticated application user. Authentication credentials should be handled by the selected authentication provider rather than stored as custom plaintext credentials.

### Project

A user-owned energy system/project. Suggested fields include an ID, owner/user ID, name, description, timestamps, and appropriate status metadata.

### Scenario

A saved simulation configuration belonging to a project. It should capture the exact generation profile, demand profile, battery parameters, initial state of charge, efficiency values, and simulation settings required to reproduce a run.

### Simulation Run

A concrete execution of a scenario. Store enough information to identify the scenario/configuration, execution status, timestamps, and structured output/results. The exact result schema should remain compatible with the Phase 1 engine.

## Security requirements

- Every authenticated request must enforce authorization.
- Users must only be able to access their own projects, scenarios, and simulation runs unless an explicit sharing feature is later introduced.
- Never trust user IDs supplied by the browser as proof of ownership.
- Validate all user-controlled input at the application boundary.
- Do not expose database/service secrets to the client.
- Do not put private credentials or secrets in GitHub.
- Use database-level row security/access controls where supported by the chosen database.

## Engineering requirements

- Prefer a simple, maintainable stack.
- Reuse the Phase 1 simulator instead of duplicating simulation logic in frontend code.
- Keep UI, application/API, persistence, and simulation responsibilities separate.
- Use typed interfaces/models where supported.
- Validate inputs on the server even if the UI also validates them.
- Handle failures explicitly; do not silently create incomplete simulation records.
- Keep simulation execution deterministic for identical inputs and simulator version.
- Add tests for authorization, validation, CRUD operations, simulation integration, and result persistence.
- Document local development and deployment setup.

## Definition of Done

Phase 2 is complete only when:

- a new user can authenticate successfully;
- an authenticated user can create and manage a project;
- a project can contain saved scenarios;
- a scenario can be executed through the Phase 1 engine;
- simulation inputs and outputs are persisted;
- users cannot access another user's private data;
- results are displayed in a usable dashboard;
- automated tests cover important application and security paths;
- the application can be run from a clean checkout with documented setup;
- no Phase 3+ functionality is presented as complete.
