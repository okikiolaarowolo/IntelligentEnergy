import { describe, expect, it } from 'vitest';
import { optimizeEnergy } from './optimizer';

describe('optimizeEnergy', () => {
  it('uses stored solar energy to reduce a later deficit', () => {
    const result = optimizeEnergy({
      generationForecastKwh: [8, 0],
      demandForecastKwh: [2, 6],
      batteryCapacityKwh: 5,
      initialSocKwh: 0,
      chargeEfficiency: 1,
      dischargeEfficiency: 1,
      gridImportCostPerKwh: 10,
      curtailmentCostPerKwh: 0.1,
    });
    expect(result.totals.gridImportKwh).toBeLessThan(4);
    expect(result.steps[0].batteryChargeInputKwh).toBeGreaterThan(0);
    expect(result.steps[1].batteryDischargeDeliveredKwh).toBeGreaterThan(0);
  });

  it('never exceeds battery capacity or creates negative flows', () => {
    const result = optimizeEnergy({
      generationForecastKwh: [20, 0, 20],
      demandForecastKwh: [2, 20, 2],
      batteryCapacityKwh: 5,
      initialSocKwh: 2,
      chargeEfficiency: 0.9,
      dischargeEfficiency: 0.9,
    });
    for (const step of result.steps) {
      expect(step.socKwh).toBeGreaterThanOrEqual(-1e-9);
      expect(step.socKwh).toBeLessThanOrEqual(5 + 1e-9);
      expect(step.gridImportKwh).toBeGreaterThanOrEqual(-1e-9);
      expect(step.curtailedKwh).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('rejects mismatched forecast lengths', () => {
    expect(() => optimizeEnergy({
      generationForecastKwh: [1, 2],
      demandForecastKwh: [1],
      batteryCapacityKwh: 5,
      initialSocKwh: 1,
      chargeEfficiency: 0.9,
      dischargeEfficiency: 0.9,
    })).toThrow('equal length');
  });

  it('handles a battery-free system', () => {
    const result = optimizeEnergy({
      generationForecastKwh: [3, 0],
      demandForecastKwh: [5, 2],
      batteryCapacityKwh: 0,
      initialSocKwh: 0,
      chargeEfficiency: 0.9,
      dischargeEfficiency: 0.9,
    });
    expect(result.totals.gridImportKwh).toBeCloseTo(4);
    expect(result.totals.finalSocKwh).toBe(0);
  });
});
