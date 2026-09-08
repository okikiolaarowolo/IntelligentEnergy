# Phase 1 Technical Specification

## 1. Scope

Build a deterministic discrete-time energy simulator for a simple system containing:

- an energy generator;
- an electrical load/demand profile;
- a battery energy-storage system;
- a dispatch/accounting engine.

The simulator is a research and engineering foundation. It is not a real-time controller.

## 2. Time model

The simulator operates on ordered discrete time steps. Input profiles must have matching lengths. The implementation must document the duration represented by one step. If energy values are already supplied in kWh per step, no power-to-energy conversion is required.

## 3. Battery model

The battery has:

- capacity in kWh;
- initial state of charge in kWh;
- charge efficiency in `(0, 1]`;
- discharge efficiency in `(0, 1]`.

State of charge must remain within `[0, capacity]`.

For a surplus `S` sent into charging, stored energy increases by:

`stored_increase = S * charge_efficiency`

For a load deficit `D` supplied by the battery, the simulator must distinguish energy removed from the battery from energy delivered to the load. With the convention that `battery_draw` is energy removed from storage:

`load_served_by_battery = battery_draw * discharge_efficiency`

and therefore:

`battery_draw = load_served_by_battery / discharge_efficiency`.

The implementation must never draw more energy from the battery than its current state of charge.

## 4. Dispatch algorithm

For every time step:

### Step A — Direct supply

`direct = min(generation, demand)`

### Step B — Surplus

`surplus = generation - direct`

If surplus is positive, charge the battery subject to remaining capacity. Any surplus that cannot be stored is curtailed.

### Step C — Deficit

`deficit = demand - direct`

If deficit is positive, discharge the battery subject to its state of charge. Any deficit that cannot be supplied is unmet demand.

### Step D — State update

Update and record battery state of charge and all flows.

## 5. Accounting

The implementation must make its accounting convention explicit. For each step, the load balance must satisfy:

`demand = direct + battery_discharge_delivered + unmet`

Generation must be accounted for as:

`generation = direct + battery_charge_input + curtailed`

where `battery_charge_input` is the generation energy entering the battery before charge losses.

Battery state-of-charge changes must reflect charge and discharge efficiencies under the chosen convention.

## 6. Input validation

Reject, rather than silently modify:

- negative generation values;
- negative demand values;
- negative battery capacity;
- initial state of charge outside the battery capacity;
- efficiencies less than or equal to zero;
- efficiencies greater than one;
- mismatched profile lengths;
- non-finite numeric values where the implementation supports floating-point input.

## 7. Architecture

Keep at least these responsibilities separate:

1. **Models/configuration** — parameters and validated inputs.
2. **Simulation engine** — dispatch and state transitions.
3. **Results** — structured per-step and aggregate outputs.
4. **Tests** — behavioral and accounting verification.
5. **Example/data layer** — reproducible sample scenarios, separate from the engine.

Visualization must not be required for the core simulator to operate.

## 8. Testing strategy

Tests should verify both expected behavior and invariants. In particular, test:

- exact balance;
- surplus charging;
- battery saturation and curtailment;
- deficit discharge;
- battery depletion and unmet demand;
- zero-generation and zero-demand conditions;
- invalid configuration;
- repeated execution with identical inputs producing identical results.

## 9. Reproducibility

The repository must contain at least one small, human-readable example scenario. Running that scenario from a clean checkout should produce the same result every time.

## 10. Non-goals

Phase 1 must not introduce predictive ML, optimization research, SaaS authentication/billing, autonomous control, or hardware integration.
