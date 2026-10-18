import { investigateEnergy, type InvestigationInput, type InvestigationReport } from '@/lib/energy-investigation-agent';
import { optimizeEnergy, type OptimizationInput, type OptimizationResult } from '@/lib/optimizer';

export type ToolResult<T> = {
  toolResultId: string;
  toolName: string;
  status: 'ok' | 'needs_more_data' | 'invalid_input' | 'error';
  units: Record<string, string>;
  assumptions: string[];
  warnings: string[];
  data: T | null;
};

export type EnergyToolContext = {
  runId: string;
  datasetId: string;
  assumptions?: string[];
};

/** Pure, deterministic tool adapters. These do not call an LLM or control hardware. */
export function runOptimizationTool(
  context: EnergyToolContext,
  input: OptimizationInput,
): ToolResult<OptimizationResult> {
  const toolResultId = `${context.runId}:optimize:1`;
  try {
    const data = optimizeEnergy(input);
    return {
      toolResultId,
      toolName: 'optimize_energy_scenario',
      status: 'ok',
      units: { energy: 'kWh', objectiveCost: 'optimizer-defined cost units' },
      assumptions: context.assumptions ?? ['Optimizer defaults apply to any cost parameters not supplied.'],
      warnings: [],
      data,
    };
  } catch (error) {
    return {
      toolResultId,
      toolName: 'optimize_energy_scenario',
      status: 'invalid_input',
      units: { energy: 'kWh' },
      assumptions: context.assumptions ?? [],
      warnings: [error instanceof Error ? error.message : 'Optimization failed validation.'],
      data: null,
    };
  }
}

export function runInvestigationTool(
  context: EnergyToolContext,
  input: InvestigationInput,
): ToolResult<InvestigationReport> {
  const toolResultId = `${context.runId}:investigate:1`;
  try {
    const data = investigateEnergy(input);
    return {
      toolResultId,
      toolName: 'investigate_energy_profile',
      status: 'ok',
      units: { energy: 'kWh', peakDemand: 'kWh per supplied step' },
      assumptions: [...data.assumptions, ...(context.assumptions ?? [])],
      warnings: [...data.limitations],
      data,
    };
  } catch (error) {
    return {
      toolResultId,
      toolName: 'investigate_energy_profile',
      status: 'invalid_input',
      units: { energy: 'kWh' },
      assumptions: context.assumptions ?? [],
      warnings: [error instanceof Error ? error.message : 'Investigation failed validation.'],
      data: null,
    };
  }
}

export type ClaimToVerify = {
  claimId: string;
  text: string;
  toolResultIds: string[];
  /** Exact numeric facts claimed, with a matching numeric value from cited tool data. */
  numericFacts?: Array<{ label: string; claimedValue: number; verifiedValue: number; tolerance?: number }>;
};

export type ClaimVerification = {
  claimId: string;
  status: 'verified' | 'unsupported' | 'mismatch';
  reasons: string[];
};

/**
 * Deterministic final gate for proposed report claims. The caller supplies only result IDs
 * that actually exist in the current run's tool-result ledger.
 */
export function verifyClaims(
  claims: ClaimToVerify[],
  availableToolResultIds: string[],
): ClaimVerification[] {
  const available = new Set(availableToolResultIds);
  return claims.map((claim) => {
    const reasons: string[] = [];
    if (claim.toolResultIds.length === 0 || claim.toolResultIds.some((id) => !available.has(id))) {
      reasons.push('Claim has no valid supporting tool result ID.');
      return { claimId: claim.claimId, status: 'unsupported', reasons };
    }

    for (const fact of claim.numericFacts ?? []) {
      const tolerance = fact.tolerance ?? Math.max(0.1, Math.abs(fact.verifiedValue) * 0.02);
      if (!Number.isFinite(fact.claimedValue) || !Number.isFinite(fact.verifiedValue)
        || Math.abs(fact.claimedValue - fact.verifiedValue) > tolerance) {
        reasons.push(`Numeric claim "${fact.label}" does not match the verified tool value within tolerance ${tolerance}.`);
      }
    }

    return reasons.length
      ? { claimId: claim.claimId, status: 'mismatch', reasons }
      : { claimId: claim.claimId, status: 'verified', reasons: ['All cited result IDs exist and supplied numeric facts match deterministic values.'] };
  });
}
