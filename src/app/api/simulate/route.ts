import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runSimulation, type SimulationInput } from '@/lib/simulator';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json() as { scenarioId?: string };
    if (!body.scenarioId) return NextResponse.json({ error: 'scenarioId is required' }, { status: 400 });

    const { data: scenario, error: scenarioError } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', body.scenarioId)
      .single();
    if (scenarioError || !scenario) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });

    const input: SimulationInput = {
      generationProfile: scenario.generation_profile,
      demandProfile: scenario.demand_profile,
      batteryCapacityKwh: scenario.battery_capacity_kwh,
      initialSocKwh: scenario.initial_soc_kwh,
      chargeEfficiency: scenario.charge_efficiency,
      dischargeEfficiency: scenario.discharge_efficiency,
    };
    const result = runSimulation(input);
    const { data: run, error: insertError } = await supabase.from('simulation_runs').insert({
      scenario_id: body.scenarioId,
      status: 'completed',
      simulator_version: 'phase-1-ts-1.0.0',
      input_snapshot: input,
      result_snapshot: result,
      completed_at: new Date().toISOString(),
    }).select('id, created_at, completed_at').single();
    if (insertError) throw insertError;
    return NextResponse.json({ id: run.id, result, createdAt: run.created_at, completedAt: run.completed_at }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Simulation failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
