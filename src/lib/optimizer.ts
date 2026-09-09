export type OptimizationInput = {
  generationForecastKwh: number[];
  demandForecastKwh: number[];
  batteryCapacityKwh: number;
  initialSocKwh: number;
  chargeEfficiency: number;
  dischargeEfficiency: number;
  gridImportCostPerKwh?: number;
  curtailmentCostPerKwh?: number;
  batteryThroughputCostPerKwh?: number;
  terminalSocTargetKwh?: number;
};

export type OptimizationStep = {
  step: number;
  generationKwh: number;
  demandKwh: number;
  directGenerationToLoadKwh: number;
  batteryChargeInputKwh: number;
  batteryDischargeDeliveredKwh: number;
  gridImportKwh: number;
  curtailedKwh: number;
  socKwh: number;
  stepCost: number;
};

export type OptimizationResult = {
  modelVersion: string;
  objectiveCost: number;
  resolutionKwh: number;
  steps: OptimizationStep[];
  totals: {
    generationKwh: number;
    demandKwh: number;
    gridImportKwh: number;
    curtailedKwh: number;
    batteryChargeInputKwh: number;
    batteryDischargeDeliveredKwh: number;
    finalSocKwh: number;
  };
};

const MODEL_VERSION = 'dp-storage-v1';
const MAX_HORIZON_STEPS = 48;
const MAX_SOC_STATES = 120;
const DEFAULT_GRID_COST = 1;
const DEFAULT_CURTAILMENT_COST = 0.1;
const DEFAULT_THROUGHPUT_COST = 0.01;
const DEFAULT_TERMINAL_SOC_COST = 0.05;

function finiteNonNegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a finite non-negative number`);
}

function finitePositive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a finite positive number`);
}

export function validateOptimizationInput(input: OptimizationInput) {
  if (!Array.isArray(input.generationForecastKwh) || !Array.isArray(input.demandForecastKwh)) throw new Error('Forecast profiles must be arrays');
  if (input.generationForecastKwh.length !== input.demandForecastKwh.length) throw new Error('Generation and demand forecasts must have equal length');
  if (input.generationForecastKwh.length < 1 || input.generationForecastKwh.length > MAX_HORIZON_STEPS) throw new Error(`Forecast horizon must contain 1 to ${MAX_HORIZON_STEPS} steps`);
  input.generationForecastKwh.forEach((value, i) => finiteNonNegative(value, `generationForecastKwh[${i}]`));
  input.demandForecastKwh.forEach((value, i) => finiteNonNegative(value, `demandForecastKwh[${i}]`));
  finiteNonNegative(input.batteryCapacityKwh, 'batteryCapacityKwh');
  finiteNonNegative(input.initialSocKwh, 'initialSocKwh');
  if (input.initialSocKwh > input.batteryCapacityKwh) throw new Error('initialSocKwh cannot exceed batteryCapacityKwh');
  if (!Number.isFinite(input.chargeEfficiency) || input.chargeEfficiency <= 0 || input.chargeEfficiency > 1) throw new Error('chargeEfficiency must be in (0, 1]');
  if (!Number.isFinite(input.dischargeEfficiency) || input.dischargeEfficiency <= 0 || input.dischargeEfficiency > 1) throw new Error('dischargeEfficiency must be in (0, 1]');
  finitePositive(input.gridImportCostPerKwh ?? DEFAULT_GRID_COST, 'gridImportCostPerKwh');
  finiteNonNegative(input.curtailmentCostPerKwh ?? DEFAULT_CURTAILMENT_COST, 'curtailmentCostPerKwh');
  finiteNonNegative(input.batteryThroughputCostPerKwh ?? DEFAULT_THROUGHPUT_COST, 'batteryThroughputCostPerKwh');
  finiteNonNegative(input.terminalSocTargetKwh ?? input.initialSocKwh, 'terminalSocTargetKwh');
  if ((input.terminalSocTargetKwh ?? input.initialSocKwh) > input.batteryCapacityKwh) throw new Error('terminalSocTargetKwh cannot exceed batteryCapacityKwh');
}

type State = { cost: number; steps: OptimizationStep[] };

export function optimizeEnergy(input: OptimizationInput): OptimizationResult {
  validateOptimizationInput(input);
  const gridCost = input.gridImportCostPerKwh ?? DEFAULT_GRID_COST;
  const curtailmentCost = input.curtailmentCostPerKwh ?? DEFAULT_CURTAILMENT_COST;
  const throughputCost = input.batteryThroughputCostPerKwh ?? DEFAULT_THROUGHPUT_COST;
  const terminalTarget = input.terminalSocTargetKwh ?? input.initialSocKwh;
  const resolution = input.batteryCapacityKwh === 0 ? 0 : Math.max(0.05, input.batteryCapacityKwh / MAX_SOC_STATES);
  const stateCount = input.batteryCapacityKwh === 0 ? 1 : Math.ceil(input.batteryCapacityKwh / resolution);
  const actualResolution = input.batteryCapacityKwh === 0 ? 0 : input.batteryCapacityKwh / stateCount;
  const initialIndex = input.batteryCapacityKwh === 0 ? 0 : Math.round(input.initialSocKwh / actualResolution);

  let states = new Map<number, State>([[initialIndex, { cost: 0, steps: [] }]]);

  for (let i = 0; i < input.generationForecastKwh.length; i += 1) {
    const generation = input.generationForecastKwh[i];
    const demand = input.demandForecastKwh[i];
    const direct = Math.min(generation, demand);
    const surplus = generation - direct;
    const deficit = demand - direct;
    const nextStates = new Map<number, State>();

    for (const [stateIndex, state] of states) {
      const soc = stateIndex * actualResolution;
      const maxChargeInput = actualResolution === 0 ? 0 : Math.min(surplus, (input.batteryCapacityKwh - soc) / input.chargeEfficiency);
      const maxDischargeFromSoc = Math.min(deficit / input.dischargeEfficiency, soc);
      const candidates = new Set<number>([stateIndex]);
      if (actualResolution > 0) {
        const maxChargeDelta = Math.min(input.batteryCapacityKwh - soc, maxChargeInput * input.chargeEfficiency);
        const maxDischargeDelta = Math.min(soc, maxDischargeFromSoc);
        const maxChargeSteps = Math.floor(maxChargeDelta / actualResolution);
        const maxDischargeSteps = Math.floor(maxDischargeDelta / actualResolution);
        for (let delta = 1; delta <= maxChargeSteps; delta += 1) candidates.add(stateIndex + delta);
        for (let delta = 1; delta <= maxDischargeSteps; delta += 1) candidates.add(stateIndex - delta);
      }

      for (const nextIndex of candidates) {
        const nextSoc = nextIndex * actualResolution;
        const socDelta = nextSoc - soc;
        const chargeInput = socDelta > 0 ? socDelta / input.chargeEfficiency : 0;
        const dischargeDelivered = socDelta < 0 ? -socDelta * input.dischargeEfficiency : 0;
        if (chargeInput > surplus + 1e-9 || dischargeDelivered > deficit + 1e-9) continue;
        const gridImport = Math.max(0, deficit - dischargeDelivered);
        const curtailed = Math.max(0, surplus - chargeInput);
        const stepCost = gridImport * gridCost + curtailed * curtailmentCost + (chargeInput + (socDelta < 0 ? -socDelta : 0)) * throughputCost;
        const totalCost = state.cost + stepCost;
        const candidateStep: OptimizationStep = {
          step: i + 1,
          generationKwh: generation,
          demandKwh: demand,
          directGenerationToLoadKwh: direct,
          batteryChargeInputKwh: chargeInput,
          batteryDischargeDeliveredKwh: dischargeDelivered,
          gridImportKwh: gridImport,
          curtailedKwh: curtailed,
          socKwh: nextSoc,
          stepCost,
        };
        const existing = nextStates.get(nextIndex);
        if (!existing || totalCost < existing.cost) nextStates.set(nextIndex, { cost: totalCost, steps: [...state.steps, candidateStep] });
      }
    }
    states = nextStates;
  }

  if (states.size === 0) throw new Error('No feasible storage schedule could be found');
  let best: State | undefined;
  for (const [stateIndex, state] of states) {
    const terminalPenalty = Math.abs(stateIndex * actualResolution - terminalTarget) * DEFAULT_TERMINAL_SOC_COST;
    const candidate = { cost: state.cost + terminalPenalty, steps: state.steps };
    if (!best || candidate.cost < best.cost) best = candidate;
  }
  if (!best) throw new Error('Optimizer failed to produce a schedule');

  const totals = best.steps.reduce((acc, step) => ({
    generationKwh: acc.generationKwh + step.generationKwh,
    demandKwh: acc.demandKwh + step.demandKwh,
    gridImportKwh: acc.gridImportKwh + step.gridImportKwh,
    curtailedKwh: acc.curtailedKwh + step.curtailedKwh,
    batteryChargeInputKwh: acc.batteryChargeInputKwh + step.batteryChargeInputKwh,
    batteryDischargeDeliveredKwh: acc.batteryDischargeDeliveredKwh + step.batteryDischargeDeliveredKwh,
    finalSocKwh: step.socKwh,
  }), { generationKwh: 0, demandKwh: 0, gridImportKwh: 0, curtailedKwh: 0, batteryChargeInputKwh: 0, batteryDischargeDeliveredKwh: 0, finalSocKwh: input.initialSocKwh });

  return { modelVersion: MODEL_VERSION, objectiveCost: best.cost, resolutionKwh: actualResolution, steps: best.steps, totals };
}
