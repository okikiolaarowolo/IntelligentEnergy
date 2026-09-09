import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { forecastEnergy, type ForecastObservation } from '@/lib/forecasting';

async function getClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(request: Request) {
  const { supabase, user } = await getClient();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  const { data, error } = await supabase.from('forecast_datasets').select('id, project_id, name, observations, created_at, updated_at').eq('project_id', projectId).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { supabase, user } = await getClient();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const projectId = typeof body.projectId === 'string' ? body.projectId : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const observations = Array.isArray(body.observations) ? body.observations as ForecastObservation[] : [];
    const horizonSteps = Number(body.horizonSteps ?? 6);
    const lagCount = Number(body.lagCount ?? 0);
    const target = body.target === 'demand' || body.target === 'generation' || body.target === 'both' ? body.target : 'both';
    if (!projectId || !name || name.length > 120) return NextResponse.json({ error: 'projectId and a dataset name are required' }, { status: 400 });
    const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).eq('owner_user_id', user.id).maybeSingle();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const normalized = observations.map((row) => ({ timestamp: row.timestamp, generationKwh: Number(row.generationKwh), demandKwh: Number(row.demandKwh) }));
    const result = forecastEnergy(normalized, horizonSteps, lagCount, target);
    const { data: dataset, error: datasetError } = await supabase.from('forecast_datasets').insert({ project_id: projectId, name, observations: normalized }).select('id, project_id, name, observations, created_at').single();
    if (datasetError) return NextResponse.json({ error: datasetError.message }, { status: 400 });
    const { data: run, error: runError } = await supabase.from('forecast_runs').insert({
      dataset_id: dataset.id,
      target,
      horizon_steps: result.horizonSteps,
      lag_count: result.lagCount,
      model_version: result.modelVersion,
      input_snapshot: { observations: normalized },
      result_snapshot: result.forecasts,
      metrics_snapshot: result.series.map((s) => ({ target: s.target, metrics: s.metrics })),
    }).select('*').single();
    if (runError) return NextResponse.json({ error: runError.message }, { status: 400 });
    return NextResponse.json({ dataset, run, result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid forecast request' }, { status: 400 });
  }
}
