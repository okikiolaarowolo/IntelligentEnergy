import { describe, expect, it } from 'vitest';
import { calculatePilotBaseline, type PilotObservation } from '@/lib/pilot';
import { evaluatePilot } from '@/lib/pilot-evaluation';

const observations: PilotObservation[] = Array.from({ length: 12 }, (_, i) => ({
  timestamp: new Date(Date.UTC(2026, 0, 1, i)).toISOString(),
  demandKwh: 3,
  generationKwh: 5,
}));

describe('evaluatePilot', () => {
  it('reports a feasible battery improvement against the no-battery baseline', () => {
    const baseline = calculatePilotBaseline(observations);
    const evaluation = evaluatePilot({
      observations,
      batteryCapacityKwh: 10,
      initialSocKwh: 0,
      chargeEfficiency: 0.9,
      dischargeEfficiency: 0.9,
      gridImportCostPerKwh: 1,
      curtailmentCostPerKwh: 0.1,
      batteryThroughputCostPerKwh: 0.01,
    }, baseline);

    expect(evaluation.baseline.gridImportKwh).toBe(0);
    expect(evaluation.baseline.curtailedKwh).toBe(24);
    expect(evaluation.optimized.curtailedKwh).toBeLessThanOrEqual(24);
    expect(evaluation.comparison.batteryChargeInputKwh).toBeGreaterThan(0);
    expect(evaluation.assumptions.evaluationMode).toBe('historical-profile-optimization');
  });

  it('rejects an impossible initial SOC', () => {
    const baseline = calculatePilotBaseline(observations);
    expect(() => evaluatePilot({
      observations,
      batteryCapacityKwh: 5,
      initialSocKwh: 6,
      chargeEfficiency: 0.9,
      dischargeEfficiency: 0.9,
      gridImportCostPerKwh: 1,
      curtailmentCostPerKwh: 0.1,
    }, baseline)).toThrow('initialSocKwh cannot exceed batteryCapacityKwh');
  });
});
