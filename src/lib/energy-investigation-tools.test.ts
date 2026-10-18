import { describe, expect, it } from 'vitest';
import { runInvestigationTool, runOptimizationTool, verifyClaims } from '@/lib/energy-investigation-tools';

const context = { runId: 'eval-run-001', datasetId: 'synthetic-s01' };

describe('energy investigation tool adapters', () => {
  it('returns a traceable optimization result with units', () => {
    const result = runOptimizationTool(context, {
      generationForecastKwh: [0, 1, 0],
      demandForecastKwh: [3, 3, 3],
      batteryCapacityKwh: 2,
      initialSocKwh: 1,
      chargeEfficiency: 0.9,
      dischargeEfficiency: 0.9,
    });
    expect(result.status).toBe('ok');
    expect(result.toolName).toBe('optimize_energy_scenario');
    expect(result.toolResultId).toBe('eval-run-001:optimize:1');
    expect(result.units.energy).toBe('kWh');
    expect(result.data?.totals.gridImportKwh).toBeGreaterThan(0);
  });

  it('returns validation errors as structured tool results', () => {
    const result = runOptimizationTool(context, {
      generationForecastKwh: [1, 2],
      demandForecastKwh: [1],
      batteryCapacityKwh: 2,
      initialSocKwh: 1,
      chargeEfficiency: 0.9,
      dischargeEfficiency: 0.9,
    });
    expect(result.status).toBe('invalid_input');
    expect(result.data).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('rejects claims without a valid supporting tool result ID', () => {
    const result = verifyClaims([
      { claimId: 'claim-1', text: 'Grid import is 4 kWh.', toolResultIds: ['missing-result'] },
    ], ['run-1:optimize:1']);
    expect(result[0].status).toBe('unsupported');
  });

  it('flags numeric claims that do not match the deterministic value', () => {
    const result = verifyClaims([
      {
        claimId: 'claim-2',
        text: 'Grid import is 9 kWh.',
        toolResultIds: ['run-1:optimize:1'],
        numericFacts: [{ label: 'grid import', claimedValue: 9, verifiedValue: 4, tolerance: 0.1 }],
      },
    ], ['run-1:optimize:1']);
    expect(result[0].status).toBe('mismatch');
  });

  it('accepts numeric claims that match the deterministic value', () => {
    const result = verifyClaims([
      {
        claimId: 'claim-3',
        text: 'Grid import is 4 kWh.',
        toolResultIds: ['run-1:optimize:1'],
        numericFacts: [{ label: 'grid import', claimedValue: 4, verifiedValue: 4, tolerance: 0.1 }],
      },
    ], ['run-1:optimize:1']);
    expect(result[0].status).toBe('verified');
  });
});
