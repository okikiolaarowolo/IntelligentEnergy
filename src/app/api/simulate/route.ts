import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runSimulation, type SimulationInput } from '@/lib/simulator';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json() as { scenarioId: string; input: SimulationInput };
    if (!body.scenarioId || !body.input) return NextResponse.json({ error: 'scenarioId and input are required' }, { status: 400 });
    const { data: scenario, error: scenarioError } = await supabase.from('scenarios').select('id').eq('id', body.scenarioId).single();
    if (scenarioError || !scenario) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });

    const result = runSimulation(body.input);
    const { data: run, error: insertError } = await supabase.from('simulation_runs').insert({
      scenario_id: body.scenarioId,
      status: 'completed',
      simulator_version: 'phase-1-ts-1.0.0',
      input_snapshot: body.input,
      result_snapshot: result,
      completed_at: new Date().toISOString()
    }).select('id').single();
    if (insertError) throw insertError;
    return NextResponse.json({ id: run.id, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Simulation failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
