import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  const { data, error } = await supabase.from('scenarios').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 120) return NextResponse.json({ error: 'Scenario name is required and must be 1–120 characters' }, { status: 400 });
    const generationProfile = body.generationProfile;
    const demandProfile = body.demandProfile;
    if (!Array.isArray(generationProfile) || !Array.isArray(demandProfile)) return NextResponse.json({ error: 'Profiles must be arrays' }, { status: 400 });
    if (generationProfile.length !== demandProfile.length || generationProfile.length === 0) return NextResponse.json({ error: 'Profiles must have equal non-zero length' }, { status: 400 });
    const { data: project } = await supabase.from('projects').select('id').eq('id', body.projectId).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const { data, error } = await supabase.from('scenarios').insert({ project_id: body.projectId, name, generation_profile: generationProfile, demand_profile: demandProfile, battery_capacity_kwh: body.batteryCapacityKwh, initial_soc_kwh: body.initialSocKwh, charge_efficiency: body.chargeEfficiency, discharge_efficiency: body.dischargeEfficiency }).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
}
