export type ForecastObservation = {
  timestamp: string;
  generationKwh: number;
  demandKwh: number;
};

export type ForecastTarget = 'demand' | 'generation';

export type ForecastMetrics = {
  mae: number;
  rmse: number;
  mape: number;
  baselineMae: number;
  improvementPercent: number;
  testSamples: number;
};

export type ForecastSeries = {
  target: ForecastTarget;
  values: number[];
  metrics: ForecastMetrics;
};

export type ForecastResult = {
  modelVersion: string;
  lagCount: number;
  horizonSteps: number;
  forecasts: { step: number; demandKwh?: number; generationKwh?: number }[];
  series: ForecastSeries[];
};

const MODEL_VERSION = 'ar-ridge-v1';

function assertFiniteNonNegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a finite non-negative number`);
}

export function validateObservations(observations: ForecastObservation[]): ForecastObservation[] {
  if (!Array.isArray(observations) || observations.length < 12) throw new Error('At least 12 historical observations are required');
  const normalized = observations.map((row, index) => {
    if (!row || typeof row.timestamp !== 'string' || !Number.isFinite(Date.parse(row.timestamp))) throw new Error(`Invalid timestamp at observation ${index + 1}`);
    assertFiniteNonNegative(row.generationKwh, `generationKwh at observation ${index + 1}`);
    assertFiniteNonNegative(row.demandKwh, `demandKwh at observation ${index + 1}`);
    return { timestamp: new Date(row.timestamp).toISOString(), generationKwh: row.generationKwh, demandKwh: row.demandKwh };
  });
  normalized.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  for (let i = 1; i < normalized.length; i += 1) {
    if (normalized[i].timestamp === normalized[i - 1].timestamp) throw new Error('Observation timestamps must be unique');
  }
  return normalized;
}

function transpose(a: number[][]): number[][] {
  return a[0].map((_, column) => a.map((row) => row[column]));
}

function multiply(a: number[][], b: number[][]): number[][] {
  return a.map((row) => b[0].map((_, j) => row.reduce((sum, value, k) => sum + value * b[k][j], 0)));
}

function solve(matrix: number[][], vector: number[]): number[] {
  const n = matrix.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-10) throw new Error('Forecast model could not be fitted: insufficient variation in historical data');
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col];
    for (let j = col; j <= n; j += 1) a[col][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j += 1) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row[n]);
}

function fitRidge(series: number[], lagCount: number, ridge = 1e-3) {
  const features: number[][] = [];
  const labels: number[] = [];
  for (let i = lagCount; i < series.length; i += 1) {
    features.push([1, ...series.slice(i - lagCount, i).reverse()]);
    labels.push(series[i]);
  }
  const xt = transpose(features);
  const xtx = multiply(xt, features);
  for (let i = 1; i < xtx.length; i += 1) xtx[i][i] += ridge;
  const xty = multiply(xt, labels.map((v) => [v])).map((row) => row[0]);
  return solve(xtx, xty);
}

function predictNext(history: number[], coefficients: number[], lagCount: number): number {
  const features = [1, ...history.slice(-lagCount).reverse()];
  return Math.max(0, features.reduce((sum, value, i) => sum + value * coefficients[i], 0));
}

function metrics(actual: number[], predicted: number[], baseline: number[]): ForecastMetrics {
  const errors = actual.map((value, i) => value - predicted[i]);
  const mae = errors.reduce((sum, e) => sum + Math.abs(e), 0) / errors.length;
  const rmse = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);
  const nonZero = actual.filter((v) => v > 1e-9);
  const mape = nonZero.length === 0 ? 0 : actual.reduce((sum, value, i) => sum + (value > 1e-9 ? Math.abs((value - predicted[i]) / value) : 0), 0) / nonZero.length * 100;
  const baselineMae = baseline.reduce((sum, value, i) => sum + Math.abs(actual[i] - value), 0) / baseline.length;
  return { mae, rmse, mape, baselineMae, improvementPercent: baselineMae > 1e-9 ? ((baselineMae - mae) / baselineMae) * 100 : 0, testSamples: actual.length };
}

function fitAndForecast(series: number[], lagCount: number, horizonSteps: number): { forecast: number[]; metrics: ForecastMetrics } {
  const testSize = Math.max(3, Math.floor(series.length * 0.2));
  const split = series.length - testSize;
  if (split <= lagCount + 1) throw new Error(`Not enough observations for lag count ${lagCount}`);
  const train = series.slice(0, split);
  const coefficients = fitRidge(train, lagCount);
  const history = [...train];
  const predictedTest: number[] = [];
  for (let i = split; i < series.length; i += 1) {
    const prediction = predictNext(history, coefficients, lagCount);
    predictedTest.push(prediction);
    history.push(series[i]);
  }
  const actualTest = series.slice(split);
  const baseline = actualTest.map((_, i) => series[split + i - 1]);
  const finalCoefficients = fitRidge(series, lagCount);
  const futureHistory = [...series];
  const forecast: number[] = [];
  for (let i = 0; i < horizonSteps; i += 1) {
    const prediction = predictNext(futureHistory, finalCoefficients, lagCount);
    forecast.push(prediction);
    futureHistory.push(prediction);
  }
  return { forecast, metrics: metrics(actualTest, predictedTest, baseline) };
}

export function forecastEnergy(observations: ForecastObservation[], horizonSteps: number, requestedLag = 0, target: 'demand' | 'generation' | 'both' = 'both'): ForecastResult {
  const rows = validateObservations(observations);
  if (!Number.isInteger(horizonSteps) || horizonSteps < 1 || horizonSteps > 48) throw new Error('horizonSteps must be an integer from 1 to 48');
  const lagCount = requestedLag || Math.min(24, Math.max(2, Math.floor(rows.length / 4)));
  if (!Number.isInteger(lagCount) || lagCount < 2 || lagCount > 48 || lagCount >= rows.length - 3) throw new Error('lagCount must leave enough observations for training and testing');
  const targets: ForecastTarget[] = target === 'both' ? ['demand', 'generation'] : [target];
  const series = targets.map((kind) => {
    const values = rows.map((row) => kind === 'demand' ? row.demandKwh : row.generationKwh);
    const fitted = fitAndForecast(values, lagCount, horizonSteps);
    return { target: kind, values: fitted.forecast, metrics: fitted.metrics };
  });
  const forecasts = Array.from({ length: horizonSteps }, (_, i) => ({
    step: i + 1,
    ...(series.find((s) => s.target === 'demand') ? { demandKwh: series.find((s) => s.target === 'demand')!.values[i] } : {}),
    ...(series.find((s) => s.target === 'generation') ? { generationKwh: series.find((s) => s.target === 'generation')!.values[i] } : {}),
  }));
  return { modelVersion: MODEL_VERSION, lagCount, horizonSteps, forecasts, series };
}
