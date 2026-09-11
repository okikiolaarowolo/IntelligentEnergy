import type { OptimizationResult } from '@/lib/optimizer';

export type DecisionEngineInput = {
  forecastDemandKwh: number[];
  forecastGenerationKwh: number[];
  optimization: OptimizationResult;
  dataQuality?: { qualityScore?: number; warnings?: string[] };
};

export type EnergyRecommendation = {
  id: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  reason: string;
  expectedImpact: string;
  evidence: string[];
  confidence: 'high' | 'medium' | 'low';
};

export type DecisionResult = {
  modelVersion: 'decision-v1';
  summary: string;
  recommendations: EnergyRecommendation[];
  confidence: 'high' | 'medium' | 'low';
  limitations: string[];
};

export function generateEnergyDecisions(input: DecisionEngineInput): DecisionResult {
  const { forecastDemandKwh: demand, forecastGenerationKwh: generation, optimization } = input;
  if (!Array.isArray(demand) || !Array.isArray(generation) || demand.length === 0) throw new Error('Forecast profiles are required');
  if (demand.length !== generation.length || demand.length !== optimization.steps.length) throw new Error('Forecast and optimization horizons must match');
  demand.forEach((v, i) => { if (!Number.isFinite(v) || v < 0) throw new Error(`forecastDemandKwh[${i}] must be finite and non-negative`); });
  generation.forEach((v, i) => { if (!Number.isFinite(v) || v < 0) throw new Error(`forecastGenerationKwh[${i}] must be finite and non-negative`); });

  const quality = input.dataQuality?.qualityScore;
  if (quality !== undefined && (!Number.isFinite(quality) || quality < 0 || quality > 100)) throw new Error('qualityScore must be between 0 and 100');
  const peakDemand = Math.max(...demand);
  const peakDemandStep = demand.indexOf(peakDemand) + 1;
  const peakSolar = Math.max(...generation);
  const peakSolarStep = generation.indexOf(peakSolar) + 1;
  const surplus = generation.reduce((s, g, i) => s + Math.max(0, g - demand[i]), 0);
  const shortfall = demand.reduce((s, d, i) => s + Math.max(0, d - generation[i]), 0);
  const { gridImportKwh: grid, curtailedKwh: curtailed, batteryChargeInputKwh: charge, batteryDischargeDeliveredKwh: discharge } = optimization.totals;

  const recommendations: EnergyRecommendation[] = [];
  if (charge > 0 && discharge > 0) recommendations.push({ id: 'shift-renewable', priority: 'high', action: 'Shift renewable surplus into the battery for later demand.', reason: 'The optimized schedule charges during surplus and discharges during deficit periods.', expectedImpact: `${charge.toFixed(2)} kWh charged and ${discharge.toFixed(2)} kWh delivered from storage.`, evidence: [`Peak renewable generation is around step ${peakSolarStep}.`, `Peak demand is ${peakDemand.toFixed(2)} kWh at step ${peakDemandStep}.`], confidence: 'high' });
  if (surplus > 0) recommendations.push({ id: 'capture-surplus', priority: curtailed > 0 ? 'medium' : 'low', action: 'Prioritize available storage during renewable surplus before curtailing generation.', reason: `The forecast contains ${surplus.toFixed(2)} kWh of renewable surplus.`, expectedImpact: 'Improve renewable utilization when storage capacity is available.', evidence: [`Forecast surplus: ${surplus.toFixed(2)} kWh.`, `Optimized curtailment: ${curtailed.toFixed(2)} kWh.`], confidence: 'high' });
  if (grid > 0) recommendations.push({ id: 'protect-shortfall', priority: 'high', action: 'Reserve stored energy for periods where demand exceeds renewable generation.', reason: `The forecast contains ${shortfall.toFixed(2)} kWh of renewable shortfall and the optimized plan still imports ${grid.toFixed(2)} kWh.`, expectedImpact: 'Reduce grid imports where storage and forecast conditions allow.', evidence: [`Peak demand: ${peakDemand.toFixed(2)} kWh.`, `Optimized grid import: ${grid.toFixed(2)} kWh.`], confidence: 'high' });
  if (!recommendations.length) recommendations.push({ id: 'maintain-schedule', priority: 'low', action: 'Maintain the optimized schedule for this horizon.', reason: 'No material grid-import or curtailment issue was detected.', expectedImpact: 'Avoid unnecessary battery cycling while maintaining the selected objective.', evidence: [`Grid import: ${grid.toFixed(2)} kWh.`, `Curtailment: ${curtailed.toFixed(2)} kWh.`], confidence: 'medium' });

  const limitations = ['Recommendations are advisory only; IntelligentEnergy does not directly control hardware or the electrical grid.', 'Recommendations depend on the supplied forecast and optimization assumptions; real conditions can differ.'];
  if (quality !== undefined && quality < 80) limitations.push(`Data-quality score is ${quality.toFixed(0)}/100; improve input data before relying on recommendations.`);
  limitations.push(...(input.dataQuality?.warnings ?? []).slice(0, 3));
  let confidence: DecisionResult['confidence'] = quality !== undefined && quality < 50 ? 'low' : demand.length < 6 || (quality !== undefined && quality < 80) ? 'medium' : 'high';
  return { modelVersion: 'decision-v1', summary: grid > 0 ? `Prioritize renewable surplus for storage and reserve battery energy for forecast shortfalls; ${grid.toFixed(2)} kWh of grid import remains in the optimized plan.` : 'The optimized plan covers the forecast without grid imports; preserve renewable utilization and avoid unnecessary battery cycling.', recommendations, confidence, limitations };
}
