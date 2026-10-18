# Competition Agent: Energy Investigation Agent

## Purpose
Build a new, clearly scoped agent capability inside IntelligentEnergy for the AI-agent competition. It should investigate energy patterns, explain evidence, compare safe advisory actions, and create an auditable report. It must not claim autonomous hardware control.

## Existing capabilities to reuse
- Deterministic demand/generation forecasting (`ar-ridge-v1`)
- Constrained battery scheduling (`dp-storage-v1`)
- Pilot CSV validation and data-quality warnings
- Explainable advisory recommendations (`decision-v1`)
- Project-scoped data ownership and persisted decision history

## New capability
The Energy Investigation Agent orchestrates these existing capabilities into one evidence-first investigation:
1. Validate that forecast profiles and optimization results are aligned and usable.
2. Detect actionable conditions: demand/generation shortfall, renewable surplus/curtailment, peak demand, and data-quality concerns.
3. Rank findings by impact and confidence, keeping measured facts separate from estimates.
4. Compare candidate interventions using the available optimization output; do not fabricate currency savings or guaranteed emissions reductions.
5. Return a structured report with evidence, assumptions, uncertainty, recommended next checks, and explicit limitations.
6. Remain advisory-only. No control of batteries, inverters, IoT devices, or the grid.

## Competition proof
The demo should use a labelled synthetic dataset first, then a consented pilot dataset if available. Show input quality checks, findings, recommendation rationale, and a repeatable before/after scenario. Report actual metrics and assumptions; never present simulated results as real customer savings.

## Acceptance criteria
- Deterministic and unit-tested outputs for identical inputs.
- Reject mismatched horizons, invalid values, and missing evidence.
- Recommendations cite concrete values from the supplied data.
- Low-quality inputs lower confidence and appear as a warning, not hidden.
- No autonomous hardware action or unsupported financial claims.
- Documentation distinguishes existing features from the new agent orchestration.

## Work sequence
1. Implement a pure, testable investigation module.
2. Add unit tests for shortfall, surplus, data quality, and invalid input.
3. Add a minimal UI/API entry point only after the module is tested.
4. Run typecheck, lint, tests, and build before opening a review.
