import type { OptimizationResult } from '@/lib/optimizer';

export type InvestigationInput = {
  forecastDemandKwh: number[];
  forecastGenerationKwh: number[];
  optimization: OptimizationResult;
  dataQuality?: { qualityScore?: number; warnings?: string[] };
};

export type InvestigationFinding = {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  explanation: string;
  evidence: string[];
  recommendedNextStep: string;
  confidence: 'high' | 'medium' | 'low';
};

export type InvestigationReport = {
  agentVersion: 'energy-investigator-v1';
  status: 'action-needed' | 'monitor' | 'no-major-issue-detected';
  headline: string;
  findings: InvestigationFinding[];
  keyMetrics: {
    forecastDemandKwh: number;
    forecastGenerationKwh: number;
    forecastShortfallKwh: number;
    forecastSurplusKwh: number;
    optimizedGridImportKwh: number;
    optimizedCurtailmentKwh: number;
    peakDemandKwh: number;
    peakDemandStep: number;
  };
  assumptions: string[];
  limitations: string[];
};

function assertProfile(values: number[], label: string) {
  if (!Array.isArray(values) || values.length === 0) throw new Error(`${label} profile is required`);
  values.forEach((value, index) => {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${label}[${index}] must be finite and non-negative`);
  });
}

/**
 * Evidence-first investigation orchestration for the competition prototype.
 * This is deterministic decision support, not a language model or hardware controller.
 */
export function investigateEnergy(input: InvestigationInput): InvestigationReport {
  const demand = input.forecastDemandKwh;
  const generation = input.forecastGenerationKwh;
  assertProfile(demand, 'forecastDemandKwh');
  assertProfile(generation, 'forecastGenerationKwh');

  if (demand.length !== generation.length || demand.length !== input.optimization.steps.length) {
    throw new Error('Forecast and optimization horizons must match');
  }

  const quality = input.dataQuality?.qualityScore;
  if (quality !== undefined && (!Number.isFinite(quality) || quality < 0 || quality > 100)) {
    throw new Error('qualityScore must be between 0 and 100');
  }

  const forecastDemandKwh = demand.reduce((sum, value) => sum + value, 0);
  const forecastGenerationKwh = generation.reduce((sum, value) => sum + value, 0);
  const forecastShortfallKwh = demand.reduce((sum, value, i) => sum + Math.max(0, value - generation[i]), 0);
  const forecastSurplusKwh = generation.reduce((sum, value, i) => sum + Math.max(0, value - demand[i]), 0);
  const peakDemandKwh = Math.max(...demand);
  const peakDemandStep = demand.indexOf(peakDemandKwh) + 1;
  const optimizedGridImportKwh = input.optimization.totals.gridImportKwh;
  const optimizedCurtailmentKwh = input.optimization.totals.curtailedKwh;
  const findings: InvestigationFinding[] = [];

  if (optimizedGridImportKwh > 0) {
    findings.push({
      id: 'residual-grid-import',
      severity: optimizedGridImportKwh >= forecastDemandKwh * 0.25 ? 'high' : 'medium',
      title: 'Grid import remains in the optimized scenario',
      explanation: 'The current optimized schedule does not cover all demand from the available renewable generation and storage assumptions.',
      evidence: [
        `Optimized grid import: ${optimizedGridImportKwh.toFixed(2)} kWh.`,
        `Forecast demand: ${forecastDemandKwh.toFixed(2)} kWh.`,
        `Forecast renewable shortfall before storage: ${forecastShortfallKwh.toFixed(2)} kWh.`,
      ],
      recommendedNextStep: 'Review demand timing, battery capacity, initial state of charge, and tariff assumptions before comparing alternative schedules.',
      confidence: quality !== undefined && quality < 50 ? 'low' : 'medium',
    });
  }

  if (forecastSurplusKwh > 0) {
    findings.push({
      id: 'renewable-surplus',
      severity: optimizedCurtailmentKwh > 0 ? 'high' : 'low',
      title: optimizedCurtailmentKwh > 0 ? 'Renewable curtailment is present' : 'Renewable surplus is available',
      explanation: optimizedCurtailmentKwh > 0
        ? 'The scenario contains renewable energy that the current schedule cannot use or store.'
        : 'Forecast generation exceeds demand in at least one interval; check whether timing and storage constraints allow more of it to be used.',
      evidence: [
        `Forecast renewable surplus: ${forecastSurplusKwh.toFixed(2)} kWh.`,
        `Optimized curtailment: ${optimizedCurtailmentKwh.toFixed(2)} kWh.`,
      ],
      recommendedNextStep: 'Compare a revised storage schedule or flexible-load timing, while respecting battery and operational constraints.',
      confidence: quality !== undefined && quality < 50 ? 'low' : 'medium',
    });
  }

  if (peakDemandKwh > 0) {
    findings.push({
      id: 'peak-demand',
      severity: 'medium',
      title: 'Peak demand identified',
      explanation: 'The highest forecast demand interval is a useful place to inspect operating schedules and potential load shifting.',
      evidence: [`Peak demand: ${peakDemandKwh.toFixed(2)} kWh at forecast step ${peakDemandStep}.`],
      recommendedNextStep: 'Check which flexible loads operate during this interval before proposing any schedule change.',
      confidence: demand.length >= 6 && !(quality !== undefined && quality < 50) ? 'high' : 'medium',
    });
  }

  for (const warning of (input.dataQuality?.warnings ?? []).slice(0, 3)) {
    findings.push({
      id: `data-quality-${findings.length + 1}`,
      severity: 'medium',
      title: 'Input data needs review',
      explanation: warning,
      evidence: [quality === undefined ? 'No numeric data-quality score was supplied.' : `Data-quality score: ${quality.toFixed(0)}/100.`],
      recommendedNextStep: 'Verify the source meter readings and correct missing, irregular, or suspicious values before relying on the forecast.',
      confidence: 'low',
    });
  }

  if (quality !== undefined && quality < 80 && !(input.dataQuality?.warnings?.length)) {
    findings.push({
      id: 'low-data-quality-score',
      severity: quality < 50 ? 'high' : 'medium',
      title: 'Data quality reduces confidence',
      explanation: 'The supplied data-quality score is below the preferred threshold for decision support.',
      evidence: [`Data-quality score: ${quality.toFixed(0)}/100.`],
      recommendedNextStep: 'Review data quality and rerun the analysis after correcting issues.',
      confidence: 'low',
    });
  }

  if (findings.length === 0) {
    findings.push({
      id: 'no-major-issue',
      severity: 'low',
      title: 'No major issue detected in supplied metrics',
      explanation: 'The supplied forecast and optimization totals did not trigger the current investigation rules.',
      evidence: [
        `Optimized grid import: ${optimizedGridImportKwh.toFixed(2)} kWh.`,
        `Optimized curtailment: ${optimizedCurtailmentKwh.toFixed(2)} kWh.`,
      ],
      recommendedNextStep: 'Continue monitoring and compare the scenario with future measured outcomes.',
      confidence: quality !== undefined && quality < 80 ? 'low' : 'medium',
    });
  }

  if (quality !== undefined && quality < 50) {
    findings.forEach((finding) => {
      finding.confidence = 'low';
    });
  }

  const hasActionNeeded = findings.some((finding) => finding.severity === 'critical' || finding.severity === 'high');
  const status: InvestigationReport['status'] = hasActionNeeded
    ? 'action-needed'
    : findings.some((finding) => finding.id !== 'no-major-issue')
      ? 'monitor'
      : 'no-major-issue-detected';

  return {
    agentVersion: 'energy-investigator-v1',
    status,
    headline: hasActionNeeded
      ? 'The investigation found one or more conditions worth reviewing.'
      : findings[0]?.id === 'no-major-issue'
        ? 'No major issue was detected in the supplied scenario.'
        : 'Monitor the findings and validate them against measured outcomes.',
    findings,
    keyMetrics: {
      forecastDemandKwh,
      forecastGenerationKwh,
      forecastShortfallKwh,
      forecastSurplusKwh,
      optimizedGridImportKwh,
      optimizedCurtailmentKwh,
      peakDemandKwh,
      peakDemandStep,
    },
    assumptions: [
      'Forecast values represent the supplied model output, not guaranteed future measurements.',
      'Optimization totals depend on the battery, efficiency, and cost assumptions used in the run.',
      'Energy quantities are scenario estimates; no monetary savings or emissions reductions are inferred.',
    ],
    limitations: [
      'Advisory only: this agent does not control batteries, inverters, IoT devices, or the electrical grid.',
      'Findings are rule-based and deterministic; they are not proof of a physical fault or energy theft.',
      'Validate recommendations with a qualified operator and measured outcomes before acting.',
    ],
  };
}
