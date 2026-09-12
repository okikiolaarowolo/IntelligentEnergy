# Phase 8 — Production Readiness & Energy Intelligence Overview

## Goal

Turn the completed analytical pipeline into a presentation-ready operator experience without introducing hardware control or autonomous actions.

## Included

- Unified Energy Intelligence Overview at `/dashboard/overview`.
- Project-scoped summary of the prediction, optimization, and decision layers.
- Latest optimization energy-balance snapshot.
- Latest explainable decision and confidence.
- Direct navigation between Pilot, Prediction, Optimization, and Decision Center.
- Explicit product boundaries and modeling limitations.

## Product flow

**Historical data → Prediction → Optimization → Evaluation → Decision → Overview**

## Safety boundary

Phase 8 remains advisory. It does not control batteries, inverters, appliances, generators, or the electrical grid. Forecasts and recommendations are dependent on supplied data and assumptions and are not guarantees of real-world performance.

## Non-goals

- Direct hardware/IoT control
- Autonomous dispatch
- Grid-market bidding
- Billing/payments
- New forecasting model families
- Production claims based on historical-profile optimization alone

## Presentation objective

A presenter should be able to open the Overview, select a project, and explain the system in one coherent path rather than navigating disconnected technical labs.
