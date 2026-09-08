export type SimulationInput = {
  generationProfile: number[];
  demandProfile: number[];
  batteryCapacityKwh: number;
  initialSocKwh: number;
  chargeEfficiency: number;
  dischargeEfficiency: number;
};

export type SimulationStep = {
  generation: number;
  demand: number;
  directGenerationToLoad: number;
  batteryChargeInput: number;
  batteryDischargeDelivered: number;
  curtailed: number;
  unmet: number;
  socKwh: number;
};

export type SimulationResult = {
  steps: SimulationStep[];
  totals: {
    generation: number;
    demand: number;
    directGenerationToLoad: number;
    batteryChargeInput: number;
    batteryDischargeDelivered: number;
    curtailed: number;
    unmet: number;
    finalSocKwh: number;
  };
};

function finiteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a finite non-negative number`);
}

export function validateSimulationInput(input: SimulationInput): void {
  if (!Array.isArray(input.generationProfile) || !Array.isArray(input.demandProfile)) throw new Error("Profiles must be arrays");
  if (input.generationProfile.length !== input.demandProfile.length) throw new Error("Generation and demand profiles must have equal length");
  input.generationProfile.forEach((v, i) => finiteNonNegative(v, `generationProfile[${i}]`));
  input.demandProfile.forEach((v, i) => finiteNonNegative(v, `demandProfile[${i}]`));
  finiteNonNegative(input.batteryCapacityKwh, "batteryCapacityKwh");
  finiteNonNegative(input.initialSocKwh, "initialSocKwh");
  if (input.initialSocKwh > input.batteryCapacityKwh) throw new Error("initialSocKwh cannot exceed batteryCapacityKwh");
  if (!Number.isFinite(input.chargeEfficiency) || input.chargeEfficiency <= 0 || input.chargeEfficiency > 1) throw new Error("chargeEfficiency must be in (0, 1]");
  if (!Number.isFinite(input.dischargeEfficiency) || input.dischargeEfficiency <= 0 || input.dischargeEfficiency > 1) throw new Error("dischargeEfficiency must be in (0, 1]");
}

export function runSimulation(input: SimulationInput): SimulationResult {
  validateSimulationInput(input);
  let soc = input.initialSocKwh;
  const steps: SimulationStep[] = [];

  for (let i = 0; i < input.generationProfile.length; i += 1) {
    const generation = input.generationProfile[i];
    const demand = input.demandProfile[i];
    const direct = Math.min(generation, demand);
    const surplus = generation - direct;
    const deficit = demand - direct;

    const maxChargeInput = input.batteryCapacityKwh > soc
      ? (input.batteryCapacityKwh - soc) / input.chargeEfficiency
      : 0;
    const chargeInput = Math.min(surplus, Math.max(0, maxChargeInput));
    soc += chargeInput * input.chargeEfficiency;
    const curtailed = surplus - chargeInput;

    const maxBatteryDraw = soc;
    const batteryDraw = Math.min(deficit / input.dischargeEfficiency, maxBatteryDraw);
    const batteryDischargeDelivered = batteryDraw * input.dischargeEfficiency;
    soc -= batteryDraw;
    const unmet = deficit - batteryDischargeDelivered;

    steps.push({ generation, demand, directGenerationToLoad: direct, batteryChargeInput: chargeInput, batteryDischargeDelivered, curtailed, unmet, socKwh: soc });
  }

  const totals = steps.reduce((a, s) => ({
    generation: a.generation + s.generation,
    demand: a.demand + s.demand,
    directGenerationToLoad: a.directGenerationToLoad + s.directGenerationToLoad,
    batteryChargeInput: a.batteryChargeInput + s.batteryChargeInput,
    batteryDischargeDelivered: a.batteryDischargeDelivered + s.batteryDischargeDelivered,
    curtailed: a.curtailed + s.curtailed,
    unmet: a.unmet + s.unmet,
    finalSocKwh: s.socKwh
  }), { generation: 0, demand: 0, directGenerationToLoad: 0, batteryChargeInput: 0, batteryDischargeDelivered: 0, curtailed: 0, unmet: 0, finalSocKwh: input.initialSocKwh });

  return { steps, totals };
}
