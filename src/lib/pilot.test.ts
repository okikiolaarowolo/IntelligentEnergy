import { describe, expect, it } from 'vitest';
import { calculatePilotBaseline, parsePilotCsv } from './pilot';

function csvRows(count = 12) {
  const rows = ['timestamp,demand_kwh,generation_kwh'];
  for (let i = 0; i < count; i += 1) {
    rows.push(`2026-09-01T${String(i).padStart(2, '0')}:00:00Z,${i + 2},${i % 2 === 0 ? 3 : 1}`);
  }
  return rows.join('\n');
}

describe('pilot CSV validation', () => {
  it('parses valid rows and detects the sampling interval', () => {
    const result = parsePilotCsv(csvRows());
    expect(result.observations).toHaveLength(12);
    expect(result.intervalMinutes).toBe(60);
    expect(result.observations[0].demandKwh).toBe(2);
  });

  it('rejects fewer than 12 observations', () => {
    expect(() => parsePilotCsv(csvRows(11))).toThrow('At least 12 observations');
  });

  it('rejects irregular timestamps', () => {
    const rows = csvRows().split('\n');
    rows[3] = '2026-09-01T03:30:00Z,5,2';
    expect(() => parsePilotCsv(rows.join('\n'))).toThrow('consistent sampling interval');
  });

  it('rejects negative energy values', () => {
    const rows = csvRows().split('\n');
    rows[1] = '2026-09-01T00:00:00Z,-1,2';
    expect(() => parsePilotCsv(rows.join('\n'))).toThrow('non-negative');
  });
});

describe('pilot baseline', () => {
  it('calculates direct renewable supply, grid import, and curtailment', () => {
    const baseline = calculatePilotBaseline([
      { timestamp: '2026-09-01T00:00:00Z', demandKwh: 5, generationKwh: 3 },
      { timestamp: '2026-09-01T01:00:00Z', demandKwh: 2, generationKwh: 6 },
    ]);
    expect(baseline.demandKwh).toBe(7);
    expect(baseline.generationKwh).toBe(9);
    expect(baseline.directGenerationToLoadKwh).toBe(5);
    expect(baseline.gridImportKwh).toBe(2);
    expect(baseline.curtailedKwh).toBe(4);
    expect(baseline.renewableUtilizationPercent).toBeCloseTo(55.5556, 3);
    expect(baseline.gridDependencyPercent).toBeCloseTo(28.5714, 3);
  });
});
