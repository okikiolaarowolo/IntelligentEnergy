import { optimizeEnergy, type OptimizationResult } from '@/lib/optimizer';
import type { PilotBaseline, PilotObservation } from '@/lib/pilot';

export type PilotEvaluationInput = {
  observations: PilotObservation[];
  batteryCapacityKwh: number;
  initialSocKwh: number;
  chargeEfficiency: number;
  dischargeEfficiency: number;
  gridImportCostPerKwh: number;
  curtailmentCostPerKwh: number;
  batteryThroughputCostPerKwh?: number;
};

export type PilotEvaluation = {
  modelVersion: string;
  baseline: PilotBaseline;
  optimized: OptimizationResult['totals'];
  comparison: {
    gridImportReductionKwh: number;
    gridImportReductionPercent: number;
    curtailmentReductionKwh: number;
    curtailmentReductionPercent: number;
    renewableUtilizationPercent: number;
    estimatedBaselineCost: number;
    estimatedOptimizedCost: number;
    estimatedCostDifference: number;
    estimatedCostSavingsPercent: number;
    batteryDischargeDeliveredKwh: number;
    batteryChargeInputKwh: number;
  };
  assumptions: {
    batteryCapacityKwh: number;
    initialSocKwh: number;
    chargeEfficiency: number;
    dischargeEfficiency: number;
    gridImportCostPerKwh: number;
    curtailmentCostPerKwh: number;
    batteryThroughputCostPerKwh: number;
    evaluationMode: 'historical-profile-optimization';
  };
};

function finiteNonNegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be finite and non-negative`);
}

function positive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be finite and positive`);
}

export function evaluatePilot(input: PilotEvaluationInput, baseline: PilotBaseline): PilotEvaluation {
  if (input.observations.length === 0) throw new Error('Pilot observations are required');
  finiteNonNegative(input.batteryCapacityKwh, 'batteryCapacityKwh');
  finiteNonNegative(input.initialSocKwh, 'initialSocKwh');
  if (input.initialSocKwh > input.batteryCapacityKwh) throw new Error('initialSocKwh cannot exceed batteryCapacityKwh');
  if (!Number.isFinite(input.chargeEfficiency) || input.chargeEfficiency <= 0 || input.chargeEfficiency > 1) throw new Error('chargeEfficiency must be in (0, 1]');
  if (!Number.isFinite(input.dischargeEfficiency) || input.dischargeEfficiency <= 0 || input.dischargeEfficiency > 1) throw new Error('dischargeEfficiency must be in (0, 1]');
  positive(input.gridImportCostPerKwh, 'gridImportCostPerKwh');
  finiteNonNegative(input.curtailmentCostPerKwh, 'curtailmentCostPerKwh');
  finiteNonNegative(input.batteryThroughputCostPerKwh ?? 0.01, 'batteryThroughputCostPerKwh');

  const optimized = optimizeEnergy({
    generationForecastKwh: input.observations.map((row) => row.generationKwh),
    demandForecastKwh: input.observations.map((row) => row.demandKwh),
    batteryCapacityKwh: input.batteryCapacityKwh,
    initialSocKwh: input.initialSocKwh,
    chargeEfficiency: input.chargeEfficiency,
    dischargeEfficiency: input.dischargeEfficiency,
    gridImportCostPerKwh: input.gridImportCostPerKwh,
    curtailmentCostPerKwh: input.curtailmentCostPerKwh,
    batteryThroughputCostPerKwh: input.batteryThroughputCostPerKwh,
    terminalSocTargetKwh: input.initialSocKwh,
  });

  const baselineCost = baseline.gridImportKwh * input.gridImportCostPerKwh + baseline.curtailedKwh * input.curtailmentCostPerKwh;
  const optimizedCost = optimized.gridImportKwh * input.gridImportCostPerKwh + optimized.curtailedKwh * input.curtailmentCostPerKwh + (optimized.batteryChargeInputKwh + optimized.batteryDischargeDeliveredKwh) * (input.batteryThroughputCostPerKwh ?? 0.01);
  const gridReduction = Math.max(0, baseline.gridImportKwh - optimized.gridImportKwh);
  const curtailmentReduction = Math.max(0, baseline.curtailedKwh - optimized.curtailedKwh);
  const costDifference = baselineCost - optimizedCost;
  const renewableUtilization = optimized.generationKwh > 0 ? ((optimized.generationKwh - optimized.curtailedKwh) / optimized.generationKwh) * 100 : 100;

  return {
    modelVersion: optimized.modelVersion,
    baseline,
    optimized,
    comparison: {
      gridImportReductionKwh: gridReduction,
      gridImportReductionPercent: baseline.gridImportKwh > 0 ? (gridReduction / baseline.gridImportKwh) * 100 : 0,
      curtailmentReductionKwh: curtailmentReduction,
      curtailmentReductionPercent: baseline.curtailedKwh > 0 ? (curtailmentReduction / baseline.curtailedKwh) * 100 : 0,
      renewableUtilizationPercent: renewableUtilization,
      estimatedBaselineCost: baselineCost,
      estimatedOptimizedCost: optimizedCost,
      estimatedCostDifference: costDifference,
      estimatedCostSavingsPercent: baselineCost > 0 ? (costDifference / baselineCost) * 100 : 0,
      batteryDischargeDeliveredKwh: optimized.batteryDischargeDeliveredKwh,
      batteryChargeInputKwh: optimized.batteryChargeInputKwh,
    },
    assumptions: {
      batteryCapacityKwh: input.batteryCapacityKwh,
      initialSocKwh: input.initialSocKwh,
      chargeEfficiency: input.chargeEfficiency,
      dischargeEfficiency: input.dischargeEfficiency,
      gridImportCostPerKwh: input.gridImportCostPerKwh,
      curtailmentCostPerKwh: input.curtailmentCostPerKwh,
      batteryThroughputCostPerKwh: input.batteryThroughputCostPerKwh ?? 0.01,
      evaluationMode: 'historical-profile-optimization',
    },
  };
}
