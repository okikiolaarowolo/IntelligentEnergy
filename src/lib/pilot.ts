export type PilotObservation = {
  timestamp: string;
  demandKwh: number;
  generationKwh: number;
};

export type PilotBaseline = {
  generationKwh: number;
  demandKwh: number;
  directGenerationToLoadKwh: number;
  gridImportKwh: number;
  curtailedKwh: number;
  renewableUtilizationPercent: number;
  gridDependencyPercent: number;
  averageDemandKwh: number;
  averageGenerationKwh: number;
  peakDemandKwh: number;
  peakGenerationKwh: number;
  observations: number;
};

export type ParsedPilotCsv = {
  observations: PilotObservation[];
  intervalMinutes: number;
  warnings: string[];
};

const MAX_ROWS = 10000;
const MIN_ROWS = 12;
const REQUIRED_HEADERS = ['timestamp', 'demand_kwh', 'generation_kwh'];

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(field.trim());
      field = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(field.trim());
      field = '';
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  if (inQuotes) throw new Error('CSV contains an unterminated quoted field');
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  return rows;
}

function parseNonNegative(value: string, label: string, rowNumber: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be a finite non-negative number at CSV row ${rowNumber}`);
  return parsed;
}

export function parsePilotCsv(text: string): ParsedPilotCsv {
  if (!text.trim()) throw new Error('CSV file is empty');
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ''));
  if (rows.length < 2) throw new Error('CSV must contain a header and at least one data row');
  if (rows[0].length !== REQUIRED_HEADERS.length || rows[0].map((h) => h.toLowerCase().trim()).join('|') !== REQUIRED_HEADERS.join('|')) {
    throw new Error('CSV headers must be exactly: timestamp,demand_kwh,generation_kwh');
  }
  if (rows.length - 1 < MIN_ROWS) throw new Error(`At least ${MIN_ROWS} observations are required for a pilot dataset`);
  if (rows.length - 1 > MAX_ROWS) throw new Error(`Pilot imports are limited to ${MAX_ROWS} observations`);

  const observations = rows.slice(1).map((row, index) => {
    const csvRow = index + 2;
    if (row.length !== 3) throw new Error(`CSV row ${csvRow} must contain exactly 3 columns`);
    const timestampMs = Date.parse(row[0]);
    if (!Number.isFinite(timestampMs)) throw new Error(`Invalid timestamp at CSV row ${csvRow}`);
    return {
      timestamp: new Date(timestampMs).toISOString(),
      demandKwh: parseNonNegative(row[1], 'demand_kwh', csvRow),
      generationKwh: parseNonNegative(row[2], 'generation_kwh', csvRow),
    };
  }).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  const deltasMinutes: number[] = [];
  for (let i = 1; i < observations.length; i += 1) {
    const deltaMinutes = (Date.parse(observations[i].timestamp) - Date.parse(observations[i - 1].timestamp)) / 60000;
    if (deltaMinutes <= 0) throw new Error('Timestamps must be strictly increasing and unique');
    deltasMinutes.push(deltaMinutes);
  }

  const intervalMinutes = deltasMinutes[0];
  const irregular = deltasMinutes.some((delta) => Math.abs(delta - intervalMinutes) > 1e-6);
  if (irregular) throw new Error('Timestamps must use a consistent sampling interval. Missing or irregular time steps must be cleaned before import.');

  return {
    observations,
    intervalMinutes,
    warnings: [],
  };
}

export function calculatePilotBaseline(observations: PilotObservation[]): PilotBaseline {
  if (observations.length === 0) throw new Error('At least one observation is required');
  const totals = observations.reduce((acc, row) => {
    const direct = Math.min(row.generationKwh, row.demandKwh);
    const grid = Math.max(0, row.demandKwh - row.generationKwh);
    const curtailed = Math.max(0, row.generationKwh - row.demandKwh);
    return {
      generationKwh: acc.generationKwh + row.generationKwh,
      demandKwh: acc.demandKwh + row.demandKwh,
      directGenerationToLoadKwh: acc.directGenerationToLoadKwh + direct,
      gridImportKwh: acc.gridImportKwh + grid,
      curtailedKwh: acc.curtailedKwh + curtailed,
      peakDemandKwh: Math.max(acc.peakDemandKwh, row.demandKwh),
      peakGenerationKwh: Math.max(acc.peakGenerationKwh, row.generationKwh),
    };
  }, { generationKwh: 0, demandKwh: 0, directGenerationToLoadKwh: 0, gridImportKwh: 0, curtailedKwh: 0, peakDemandKwh: 0, peakGenerationKwh: 0 });

  return {
    ...totals,
    renewableUtilizationPercent: totals.generationKwh > 0 ? (totals.directGenerationToLoadKwh / totals.generationKwh) * 100 : 100,
    gridDependencyPercent: totals.demandKwh > 0 ? (totals.gridImportKwh / totals.demandKwh) * 100 : 0,
    averageDemandKwh: totals.demandKwh / observations.length,
    averageGenerationKwh: totals.generationKwh / observations.length,
    observations: observations.length,
  };
}
