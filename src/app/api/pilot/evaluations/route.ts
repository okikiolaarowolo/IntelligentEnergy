import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculatePilotBaseline } from '@/lib/pilot';
import { evaluatePilot } from '@/lib/pilot-evaluation';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

  const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).eq('owner_user_id', user.id).maybeSingle();
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { data, error } = await supabase.from('pilot_evaluations')
    .select('id, project_id, dataset_id, model_version, assumptions, baseline_snapshot, optimized_snapshot, comparison_snapshot, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    projectId?: string;
    datasetId?: string;
    batteryCapacityKwh?: number;
    initialSocKwh?: number;
    chargeEfficiency?: number;
    dischargeEfficiency?: number;
    gridImportCostPerKwh?: number;
    curtailmentCostPerKwh?: number;
    batteryThroughputCostPerKwh?: number;
  };
  if (!body.projectId || !body.datasetId) return NextResponse.json({ error: 'projectId and datasetId are required' }, { status: 400 });

  const { data: project } = await supabase.from('projects').select('id').eq('id', body.projectId).eq('owner_user_id', user.id).maybeSingle();
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { data: dataset, error: datasetError } = await supabase.from('pilot_datasets')
    .select('id, project_id, baseline_snapshot')
    .eq('id', body.datasetId)
    .eq('project_id', body.projectId)
    .maybeSingle();
  if (datasetError) return NextResponse.json({ error: datasetError.message }, { status: 400 });
  if (!dataset) return NextResponse.json({ error: 'Pilot dataset not found' }, { status: 404 });

  const { data: observations, error: observationError } = await supabase.from('pilot_observations')
    .select('timestamp, demand_kwh, generation_kwh')
    .eq('dataset_id', body.datasetId)
    .order('timestamp', { ascending: true });
  if (observationError) return NextResponse.json({ error: observationError.message }, { status: 400 });
  if (!observations?.length) return NextResponse.json({ error: 'Pilot dataset has no observations' }, { status: 400 });

  const normalized = observations.map((row) => ({ timestamp: row.timestamp, demandKwh: Number(row.demand_kwh), generationKwh: Number(row.generation_kwh) }));
  const baseline = calculatePilotBaseline(normalized);
  const evaluation = evaluatePilot({
    observations: normalized,
    batteryCapacityKwh: body.batteryCapacityKwh ?? 10,
    initialSocKwh: body.initialSocKwh ?? 0,
    chargeEfficiency: body.chargeEfficiency ?? 0.9,
    dischargeEfficiency: body.dischargeEfficiency ?? 0.9,
    gridImportCostPerKwh: body.gridImportCostPerKwh ?? 1,
    curtailmentCostPerKwh: body.curtailmentCostPerKwh ?? 0.1,
    batteryThroughputCostPerKwh: body.batteryThroughputCostPerKwh ?? 0.01,
  }, baseline);

  const { data: saved, error: saveError } = await supabase.from('pilot_evaluations').insert({
    project_id: body.projectId,
    dataset_id: body.datasetId,
    model_version: evaluation.modelVersion,
    assumptions: evaluation.assumptions,
    baseline_snapshot: evaluation.baseline,
    optimized_snapshot: evaluation.optimized,
    comparison_snapshot: evaluation.comparison,
  }).select('id, created_at').single();
  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 400 });

  return NextResponse.json({ id: saved.id, createdAt: saved.created_at, ...evaluation });
}
