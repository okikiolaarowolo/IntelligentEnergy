import { describe, expect, it } from 'vitest';
import { investigateEnergy } from '@/lib/energy-investigation-agent';
import { optimizeEnergy } from '@/lib/optimizer';

function scenario(demand: number[], generation: number[]) {
  const optimization = optimizeEnergy({
    generationForecastKwh: generation,
    demandForecastKwh: demand,
    batteryCapacityKwh: 3,
    initialSocKwh: 1,
    chargeEfficiency: 0.9,
    dischargeEfficiency: 0.9,
  });
  return { forecastDemandKwh: demand, forecastGenerationKwh: generation, optimization };
}

describe('energy investigation agent', () => {
  it('reports residual grid import with concrete evidence', () => {
    const result = investigateEnergy(scenario([5, 5, 5], [0, 1, 0]));
    expect(result.agentVersion).toBe('energy-investigator-v1');
    expect(result.status).toBe('action-needed');
    expect(result.keyMetrics.optimizedGridImportKwh).toBeGreaterThan(0);
    expect(result.findings.some((finding) => finding.id === 'residual-grid-import')).toBe(true);
    expect(result.findings.every((finding) => finding.evidence.length > 0 && finding.recommendedNextStep.length > 0)).toBe(true);
  });

  it('detects renewable surplus and identifies peak demand', () => {
    const result = investigateEnergy(scenario([1, 2, 1], [5, 4, 0]));
    expect(result.keyMetrics.forecastSurplusKwh).toBe(6);
    expect(result.findings.some((finding) => finding.id === 'renewable-surplus')).toBe(true);
    expect(result.findings.some((finding) => finding.id === 'peak-demand' && finding.evidence[0].includes('step 2'))).toBe(true);
  });

  it('lowers confidence and includes supplied data warnings', () => {
    const result = investigateEnergy({
      ...scenario([2, 3, 4], [1, 1, 1]),
      dataQuality: { qualityScore: 35, warnings: ['Three consecutive zero readings found'] },
    });
    expect(result.findings.some((finding) => finding.title === 'Input data needs review')).toBe(true);
    expect(result.findings.every((finding) => finding.confidence === 'low')).toBe(true);
  });

  it('reports no major issue for a clean zero-load scenario', () => {
    const result = investigateEnergy({
      ...scenario([0, 0, 0], [0, 0, 0]),
      dataQuality: { qualityScore: 100, warnings: [] },
    });
    expect(result.status).toBe('no-major-issue-detected');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].id).toBe('no-major-issue');
    expect(result.keyMetrics.optimizedGridImportKwh).toBe(0);
    expect(result.keyMetrics.optimizedCurtailmentKwh).toBe(0);
  });

  it('does not flag a clean data-quality score without warnings', () => {
    const result = investigateEnergy({
      ...scenario([2, 2, 2], [2, 2, 2]),
      dataQuality: { qualityScore: 100, warnings: [] },
    });
    expect(result.findings.some((finding) => finding.id.startsWith('data-quality-') || finding.id === 'low-data-quality-score')).toBe(false);
  });

  it('rejects mismatched forecast and optimization horizons', () => {
    const valid = scenario([1, 2], [1, 1]);
    expect(() => investigateEnergy({ ...valid, forecastDemandKwh: [1] })).toThrow('horizons must match');
  });

  it('rejects negative forecast values', () => {
    const valid = scenario([1, 2], [1, 1]);
    expect(() => investigateEnergy({ ...valid, forecastDemandKwh: [1, -2] })).toThrow('finite and non-negative');
  });
});
