# Energy Investigation Agent: Tool Contracts

Status: design contract for the competition MVP. These contracts are provider-neutral and do not imply that an LLM tool-calling loop is already connected.

## Design rule
The language model may choose what to investigate and explain verified results. It must not perform energy arithmetic itself. Tools return structured JSON with stable result IDs; every material report claim cites one or more result IDs. Tool execution is read-only/advisory.

## Shared conventions
- Energy is kWh unless explicitly stated otherwise; power is kW.
- Use ISO-8601 timestamps with timezone or documented interval indexes and duration.
- Missing data is null, never silently converted to zero.
- Every result includes toolResultId, toolName, status, units, assumptions, and warnings.
- Reject malformed/conflicting records instead of guessing.
- Confidence describes evidence quality unless calibrated against labeled evaluation data.
- Never describe modeled savings as measured or guaranteed.

## Tool 1: validate_energy_data
Input: dataset ID, timezone, interval duration, and records with timestamp plus available grid import kWh, generator output kWh, solar generation kWh, demand kWh, generator runtime hours, and fuel litres.
Output: toolResultId, valid flag, record count, missing fields, duplicate timestamps, irregular intervals, impossible values, contradictions, documented quality score if available, warnings, and errors.
Rules: do not infer missing fuel, runtime, or source-level energy from total demand. Identify units and meter boundaries.

## Tool 2: summarize_energy_profile
Input: validated records, declared night-hour window, and optional site operating schedule.
Output: totals and units, peak interval/value, baseload definition/value, night/day totals, source proportions when denominators are valid, data coverage, and references to supporting intervals.
Rules: baseload is a statistical estimate; do not call night load waste without operating context.

## Tool 3: detect_energy_patterns
Input: validated profile summary, versioned thresholds, and optional site operating hours.
Output: finding ID/type/severity, observed value, comparison baseline, threshold, supporting intervals, confidence, and alternative explanations.
Initial types: night baseload, peak demand, solar surplus/curtailment, generator runtime/fuel, and data quality.
Rules: if schedule or source-level readings are missing, return needs-more-data rather than asserting a fault.

## Tool 4: optimize_energy_scenario
Input: equal-length demand/generation profiles, interval duration, battery capacity, initial state of charge, efficiencies, and supported constraints/cost assumptions.
Output: optimizer version, result ID, baseline/scenario metrics, grid import, curtailment, battery schedule, constraint violations, and assumptions.
Rules: use only constraints the existing optimizer supports; reject unsupported tariff or generator-dispatch claims.

## Tool 5: estimate_cost_scenarios
Input: source-specific kWh or generator fuel litres, applicable tariff/rate schedule, currency NGN, validity dates, and assumptions.
Output: baseline cost, scenario cost, estimated difference, calculation breakdown, source-rate references, and defensible uncertainty range.
Rules: if tariff, fuel price, fuel-consumption rate, or source allocation is missing, return insufficient-data and ask. Never convert kWh to litres without a documented model. Savings remain scenario estimates.

## Tool 6: verify_claims
Input: proposed report claims, cited result IDs, and raw structured tool results.
Output: claims marked verified, unsupported, or mismatch, with field paths and expected/observed values; report-level pass/fail.
Rules: numeric claims must come from deterministic outputs or deterministic code. Quantified savings require a reproducible formula, valid rates, units, baseline, and scenario. Block unsupported claims.

## Target agent loop
1. Validate data; ask for missing essentials or reject invalid data.
2. Plan a short investigation using only allowed finding types.
3. Call one or more read-only tools.
4. Check evidence and alternatives; gather more evidence if needed.
5. Build structured findings citing result IDs.
6. Run claim verification; repair or remove failed claims.
7. Return report, assumptions, uncertainty, next actions, and audit trace.
8. Never execute physical actions.

## Audit trace
Record request/run ID, dataset ID/version, agent/model and policy versions, plan step, tool name, validated input hash, result ID, timestamp, verifier outcome, and final report ID. Avoid secrets and unnecessary personal data.

## Implementation boundary
The current investigateEnergy module is deterministic and can be exposed as a first tool. This document defines target contracts; it does not claim all tools or an LLM orchestration loop are implemented.
