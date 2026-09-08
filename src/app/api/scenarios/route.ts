import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runSimulation, type SimulationInput } from '@/lib/simulator';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  const { data, error } = await supabase.from('scenarios').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 120) return NextResponse.json({ error: 'Scenario name is required and must be 1–120 characters' }, { status: 400 });
    if (typeof body.projectId !== 'string' || !body.projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    const input: SimulationInput = {
      generationProfile: body.generationProfile,
      demandProfile: body.demandProfile,
      batteryCapacityKwh: body.batteryCapacityKwh,
      initialSocKwh: body.initialSocKwh,
      chargeEfficiency: body.chargeEfficiency,
      dischargeEfficiency: body.dischargeEfficiency,
    };
    runSimulation(input);

    const { data: project, error: projectError } = await supabase.from('projects').select('id').eq('id', body.projectId).single();
    if (projectError || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const { data, error } = await supabase.from('scenarios').insert({
      project_id: body.projectId,
      name,
      generation_profile: input.generationProfile,
      demand_profile: input.demandProfile,
      battery_capacity_kwh: input.batteryCapacityKwh,
      initial_soc_kwh: input.initialSocKwh,
      charge_efficiency: input.chargeEfficiency,
      discharge_efficiency: input.dischargeEfficiency,
    }).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid scenario' }, { status: 400 });
  }
}
