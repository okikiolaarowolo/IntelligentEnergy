import { describe, expect, it } from 'vitest';
import { parsePilotCsv } from './pilot';

function csv(demand: number[], generation?: number[]) {
  const rows = ['timestamp,demand_kwh,generation_kwh'];
  demand.forEach((value, index) => {
    const timestamp = new Date(Date.UTC(2026, 0, 1, index)).toISOString();
    rows.push(`${timestamp},${value},${generation?.[index] ?? 4}`);
  });
  return rows.join('\n');
}

describe('pilot CSV data quality warnings', () => {
  it('returns no warnings for a regular dataset without suspicious readings', () => {
    const result = parsePilotCsv(csv(
      Array.from({ length: 12 }, (_, i) => 3 + (i % 4)),
      Array.from({ length: 12 }, (_, i) => 5 + (i % 3)),
    ));

    expect(result.observations).toHaveLength(12);
    expect(result.warnings).toEqual([]);
  });

  it('flags long runs of zero readings without rejecting the import', () => {
    const demand = Array.from({ length: 12 }, () => 3);
    demand[4] = 0;
    demand[5] = 0;
    demand[6] = 0;

    const result = parsePilotCsv(csv(demand));

    expect(result.observations).toHaveLength(12);
    expect(result.warnings.some((warning) => warning.includes('consecutive zero readings') && warning.includes('demand'))).toBe(true);
  });

  it('flags potential outliers for review without claiming they are errors', () => {
    const demand = Array.from({ length: 12 }, (_, i) => i + 1);
    demand[11] = 1000;

    const result = parsePilotCsv(csv(demand));

    expect(result.warnings.some((warning) => warning.includes('potential demand outlier'))).toBe(true);
  });
});
