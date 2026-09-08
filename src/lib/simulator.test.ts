import { describe, expect, it } from 'vitest';
import { runSimulation } from './simulator';

describe('runSimulation', () => {
  it('balances exact generation and demand', () => {
    const r = runSimulation({ generationProfile: [5], demandProfile: [5], batteryCapacityKwh: 10, initialSocKwh: 0, chargeEfficiency: 1, dischargeEfficiency: 1 });
    expect(r.steps[0].directGenerationToLoad).toBe(5);
    expect(r.steps[0].unmet).toBe(0);
    expect(r.steps[0].curtailed).toBe(0);
  });

  it('charges surplus and discharges during deficit', () => {
    const r = runSimulation({ generationProfile: [10, 0], demandProfile: [0, 5], batteryCapacityKwh: 10, initialSocKwh: 0, chargeEfficiency: 1, dischargeEfficiency: 1 });
    expect(r.steps[0].socKwh).toBe(10);
    expect(r.steps[1].batteryDischargeDelivered).toBe(5);
    expect(r.steps[1].unmet).toBe(0);
    expect(r.totals.finalSocKwh).toBe(5);
  });

  it('respects charge and discharge efficiency', () => {
    const r = runSimulation({ generationProfile: [10, 0], demandProfile: [0, 4], batteryCapacityKwh: 10, initialSocKwh: 0, chargeEfficiency: 0.8, dischargeEfficiency: 0.5 });
    expect(r.steps[0].batteryChargeInput).toBe(10);
    expect(r.steps[0].socKwh).toBe(8);
    expect(r.steps[1].batteryDischargeDelivered).toBe(4);
    expect(r.steps[1].socKwh).toBe(0);
  });

  it('preserves per-step energy accounting', () => {
    const r = runSimulation({ generationProfile: [7, 2, 9], demandProfile: [4, 6, 3], batteryCapacityKwh: 5, initialSocKwh: 1, chargeEfficiency: 0.9, dischargeEfficiency: 0.9 });
    for (const step of r.steps) {
      expect(step.generation).toBeCloseTo(step.directGenerationToLoad + step.batteryChargeInput + step.curtailed);
      expect(step.demand).toBeCloseTo(step.directGenerationToLoad + step.batteryDischargeDelivered + step.unmet);
    }
    expect(r.totals.finalSocKwh).toBeGreaterThanOrEqual(0);
    expect(r.totals.finalSocKwh).toBeLessThanOrEqual(5);
  });

  it('rejects mismatched profiles and invalid battery settings', () => {
    expect(() => runSimulation({ generationProfile: [1], demandProfile: [], batteryCapacityKwh: 1, initialSocKwh: 0, chargeEfficiency: 1, dischargeEfficiency: 1 })).toThrow();
    expect(() => runSimulation({ generationProfile: [1], demandProfile: [1], batteryCapacityKwh: 1, initialSocKwh: 2, chargeEfficiency: 1, dischargeEfficiency: 1 })).toThrow();
    expect(() => runSimulation({ generationProfile: [1], demandProfile: [1], batteryCapacityKwh: 1, initialSocKwh: 0, chargeEfficiency: 0, dischargeEfficiency: 1 })).toThrow();
    expect(() => runSimulation({ generationProfile: [Number.NaN], demandProfile: [1], batteryCapacityKwh: 1, initialSocKwh: 0, chargeEfficiency: 1, dischargeEfficiency: 1 })).toThrow();
  });
});
