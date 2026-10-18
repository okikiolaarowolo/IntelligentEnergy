# Energy Investigator Evaluation Set v1

Status: scenario specification. All scenarios are synthetic, not customer data. This set defines expected behavior; it does not claim the current prototype detects every pattern.

## Evaluation protocol
- Freeze input data, expected labels, thresholds, tool/agent version before each run.
- Run without exposing expected labels to the agent.
- Save input hash, findings, citations, confidence, clarification requests, and verifier outcomes.
- Score finding-level precision/recall, false alarms per scenario, citation validity, and numeric agreement.
- Set numeric tolerance before testing (suggested for synthetic energy totals: max of 0.1 kWh or 2% of expected value). Define cost tolerance from exact supplied rates.
- Report counts and denominators, not only percentages. Do not claim a score until tests have actually run.

## Planted-fault scenarios

### S01 — Generator used overnight
Data: timestamped intervals over at least three nights; generator runtime/fuel is non-zero during declared closed hours.
Expected: flag candidate generator operation during closed hours; cite intervals and runtime/fuel totals; ask for site schedule if absent.
False-positive guard: emergency operation or overnight security needs may be legitimate.
Required: timezone/timestamps, declared operating hours, generator runtime or output, ideally fuel readings.
Current support: not detectable from current untimestamped demand/generation-only input; richer source-level records are required.

### S02 — Elevated overnight baseload
Data: demand during declared closed hours is consistently above a known baseline or configured threshold.
Expected: compare observed and baseline values, cite intervals, and flag as a candidate.
False-positive guard: refrigeration, servers, pumps, security, or overnight activity.
Required: timestamps/timezone, site schedule, demand intervals, and threshold/baseline.
Current support: not detectable from current untimestamped profiles alone.

### S03 — Peak demand
Data: a known interval has maximum demand and exceeds a supplied threshold.
Expected: report correct value, time/interval, threshold, and possible load-shifting investigation. Do not claim a billing penalty without tariff evidence.
Current support: current investigator identifies the maximum step but lacks configurable peak thresholds and timestamps.

### S04 — Solar surplus/curtailment
Data: generation exceeds demand in known intervals; optimizer reports any curtailed energy.
Expected: distinguish raw renewable surplus from optimized curtailment and cite both values.
False-positive guard: surplus is not automatically wasted if storage, export, or flexible load can use it.
Current support: current deterministic investigator supports surplus and optimizer curtailment findings.

### S05 — Poor data quality/meter dropout
Data: missing intervals, duplicate timestamps, long zero streaks, outliers, or contradictory totals.
Expected: flag the precise issue, lower confidence, avoid filling missing data with zero, and request correction where material.
Current support: investigator can surface supplied warnings/score; timestamp-level validation needs a richer data validator.

### S06 — Clean normal operation
Data: complete, consistent readings; no threshold exceeded; no quality warnings.
Expected: no false alarm; return a monitoring/no-major-issue result with limitations.
Current support: basic no-major-issue behavior is unit-tested for a clean zero-load scenario.

### S07 — Contradictory records
Data: source totals do not reconcile with site total, or intervals overlap.
Expected: ask for clarification or mark data invalid; do not confidently diagnose a physical fault.
Current support: requires source reconciliation checks.

### S08 — Missing tariff or fuel rate
Data: energy profile exists but tariff, fuel price, generator fuel rate, or source allocation is absent.
Expected: explain that cost savings cannot yet be calculated; request missing inputs; never fabricate naira savings.
Current support: current report intentionally does not infer monetary savings.

### S09 — Negative/non-finite reading
Data: negative kWh, NaN, infinity, or malformed interval.
Expected: reject/quarantine invalid values and cite validation error.
Current support: investigation module rejects negative/non-finite profile values; ingestion-level handling still needs testing.

### S10 — High score but missing evidence
Data: quality score says 100 but required timestamps/source fields are missing.
Expected: do not treat the score as proof of completeness; identify missing fields and request them.
Current support: requires richer validation and field-presence checks.

## Initial scoreboard

| Metric | Result |
|---|---|
| Scenarios executed end-to-end | Not yet run |
| Planted patterns detected | Not yet measured |
| False alarms | Not yet measured |
| Numeric outputs within pre-set tolerance | Not yet measured |
| Claims with valid tool-result citations | Not yet measured |
| Invalid inputs safely rejected/clarified | Not yet measured |

## Release gates
1. Unit tests, typecheck, lint, and build pass.
2. Every numeric claim traces to deterministic tool output.
3. Missing data triggers clarification or an explicit limitation.
4. Simulated savings are never described as measured customer savings.
5. At least one synthetic end-to-end demo is reproducible, with results reported using denominators.
6. Any local pilot uses consented, appropriately minimized data and documents source and period.
