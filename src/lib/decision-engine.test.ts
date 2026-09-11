import { describe, expect, it } from 'vitest';
import { generateEnergyDecisions } from '@/lib/decision-engine';
import { optimizeEnergy } from '@/lib/optimizer';

describe('decision engine', () => {
  it('produces explainable recommendations from an optimization', () => {
    const demand = [2, 5, 5, 2];
    const generation = [5, 5, 1, 0];
    const optimization = optimizeEnergy({ generationForecastKwh: generation, demandForecastKwh: demand, batteryCapacityKwh: 5, initialSocKwh: 1, chargeEfficiency: 0.9, dischargeEfficiency: 0.9 });
    const result = generateEnergyDecisions({ forecastDemandKwh: demand, forecastGenerationKwh: generation, optimization });
    expect(result.modelVersion).toBe('decision-v1');
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.every((r) => r.action && r.reason && r.expectedImpact && r.evidence.length > 0)).toBe(true);
    expect(result.limitations.some((x) => x.includes('advisory only'))).toBe(true);
  });

  it('downgrades confidence for poor data quality', () => {
    const demand = [2, 3, 4];
    const generation = [3, 1, 0];
    const optimization = optimizeEnergy({ generationForecastKwh: generation, demandForecastKwh: demand, batteryCapacityKwh: 4, initialSocKwh: 1, chargeEfficiency: 0.9, dischargeEfficiency: 0.9 });
    const result = generateEnergyDecisions({ forecastDemandKwh: demand, forecastGenerationKwh: generation, optimization, dataQuality: { qualityScore: 40, warnings: ['Missing timestamps'] } });
    expect(result.confidence).toBe('low');
    expect(result.limitations.some((x) => x.includes('40/100'))).toBe(true);
  });

  it('rejects mismatched horizons', () => {
    const optimization = optimizeEnergy({ generationForecastKwh: [1, 1], demandForecastKwh: [1, 1], batteryCapacityKwh: 2, initialSocKwh: 0, chargeEfficiency: 1, dischargeEfficiency: 1 });
    expect(() => generateEnergyDecisions({ forecastDemandKwh: [1], forecastGenerationKwh: [1], optimization })).toThrow('horizons must match');
  });
});
