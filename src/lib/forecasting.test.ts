import { describe, expect, it } from 'vitest';
import { forecastEnergy, validateObservations, type ForecastObservation } from './forecasting';

function observations(count = 24): ForecastObservation[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(Date.UTC(2026, 0, 1, i)).toISOString(),
    generationKwh: 4 + (i % 6) * 0.5,
    demandKwh: 3 + (i % 4) * 0.75,
  }));
}

describe('forecasting', () => {
  it('sorts and validates historical observations', () => {
    const rows = observations(12).reverse();
    expect(validateObservations(rows)[0].timestamp).toBe(rows[rows.length - 1].timestamp);
  });

  it('rejects too little history', () => {
    expect(() => validateObservations(observations(11))).toThrow(/At least 12/);
  });

  it('produces demand and generation forecasts with evaluation metrics', () => {
    const result = forecastEnergy(observations(36), 6, 4, 'both');
    expect(result.modelVersion).toBe('ar-ridge-v1');
    expect(result.forecasts).toHaveLength(6);
    expect(result.forecasts.every((row) => (row.demandKwh ?? 0) >= 0 && (row.generationKwh ?? 0) >= 0)).toBe(true);
    expect(result.series).toHaveLength(2);
    expect(result.series[0].metrics.testSamples).toBeGreaterThan(0);
    expect(Number.isFinite(result.series[0].metrics.rmse)).toBe(true);
  });

  it('supports a single target', () => {
    const result = forecastEnergy(observations(24), 3, 3, 'demand');
    expect(result.series.map((s) => s.target)).toEqual(['demand']);
    expect(result.forecasts.every((row) => row.demandKwh !== undefined && row.generationKwh === undefined)).toBe(true);
  });
});
