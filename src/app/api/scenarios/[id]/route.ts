import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runSimulation, type SimulationInput } from '@/lib/simulator';

async function getAuthedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function toInput(row: any): SimulationInput {
  return {
    generationProfile: row.generation_profile,
    demandProfile: row.demand_profile,
    batteryCapacityKwh: row.battery_capacity_kwh,
    initialSocKwh: row.initial_soc_kwh,
    chargeEfficiency: row.charge_efficiency,
    dischargeEfficiency: row.discharge_efficiency,
  };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { data, error } = await supabase.from('scenarios').select('*').eq('id', id).single();
  if (error || !data) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const body = await request.json();
    const { data: existing, error: existingError } = await supabase.from('scenarios').select('*').eq('id', id).single();
    if (existingError || !existing) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });

    const input: SimulationInput = {
      generationProfile: body.generationProfile ?? existing.generation_profile,
      demandProfile: body.demandProfile ?? existing.demand_profile,
      batteryCapacityKwh: body.batteryCapacityKwh ?? existing.battery_capacity_kwh,
      initialSocKwh: body.initialSocKwh ?? existing.initial_soc_kwh,
      chargeEfficiency: body.chargeEfficiency ?? existing.charge_efficiency,
      dischargeEfficiency: body.dischargeEfficiency ?? existing.discharge_efficiency,
    };
    runSimulation(input);

    const updates: Record<string, unknown> = {
      generation_profile: input.generationProfile,
      demand_profile: input.demandProfile,
      battery_capacity_kwh: input.batteryCapacityKwh,
      initial_soc_kwh: input.initialSocKwh,
      charge_efficiency: input.chargeEfficiency,
      discharge_efficiency: input.dischargeEfficiency,
      updated_at: new Date().toISOString(),
    };
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120) {
        return NextResponse.json({ error: 'Scenario name must be 1–120 characters' }, { status: 400 });
      }
      updates.name = body.name.trim();
    }
    const { data, error } = await supabase.from('scenarios').update(updates).eq('id', id).select('*').single();
    if (error || !data) return NextResponse.json({ error: 'Unable to update scenario' }, { status: 400 });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid scenario' }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { error } = await supabase.from('scenarios').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Unable to delete scenario' }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const { data: scenario, error } = await supabase.from('scenarios').select('*').eq('id', id).single();
    if (error || !scenario) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    const result = runSimulation(toInput(scenario));
    const { data: run, error: insertError } = await supabase.from('simulation_runs').insert({
      scenario_id: id,
      status: 'completed',
      simulator_version: 'phase-1-ts-1.0.0',
      input_snapshot: toInput(scenario),
      result_snapshot: result,
      completed_at: new Date().toISOString(),
    }).select('id, created_at, completed_at').single();
    if (insertError) throw insertError;
    return NextResponse.json({ id: run.id, result, createdAt: run.created_at, completedAt: run.completed_at }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Simulation failed' }, { status: 400 });
  }
}
