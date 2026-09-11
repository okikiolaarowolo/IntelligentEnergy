import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateEnergyDecisions } from '@/lib/decision-engine';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).eq('owner_user_id', user.id).maybeSingle();
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  const { data, error } = await supabase.from('energy_decisions').select('id, project_id, optimization_run_id, model_version, summary, confidence, recommendations, limitations, created_at').eq('project_id', projectId).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const projectId = typeof body.projectId === 'string' ? body.projectId : '';
    const optimizationRunId = typeof body.optimizationRunId === 'string' ? body.optimizationRunId : '';
    if (!projectId || !optimizationRunId) return NextResponse.json({ error: 'projectId and optimizationRunId are required' }, { status: 400 });

    const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).eq('owner_user_id', user.id).maybeSingle();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { data: run, error: runError } = await supabase.from('optimization_runs').select('id, project_id, forecast_run_id, input_snapshot, result_snapshot').eq('id', optimizationRunId).eq('project_id', projectId).maybeSingle();
    if (runError) return NextResponse.json({ error: runError.message }, { status: 400 });
    if (!run) return NextResponse.json({ error: 'Optimization run not found' }, { status: 404 });

    const snapshot = run.result_snapshot as { steps?: Array<{ demandKwh?: number; generationKwh?: number }>; totals?: unknown };
    const input = run.input_snapshot as { demandForecastKwh?: number[]; generationForecastKwh?: number[] };
    const demand = Array.isArray(input?.demandForecastKwh) ? input.demandForecastKwh : (snapshot.steps ?? []).map((s) => Number(s.demandKwh));
    const generation = Array.isArray(input?.generationForecastKwh) ? input.generationForecastKwh : (snapshot.steps ?? []).map((s) => Number(s.generationKwh));
    if (!snapshot?.steps || demand.length !== generation.length || demand.length !== snapshot.steps.length) return NextResponse.json({ error: 'Optimization run does not contain a usable forecast snapshot' }, { status: 400 });

    const result = generateEnergyDecisions({ demand, generation, optimization: snapshot as never });
    const { data: saved, error: saveError } = await supabase.from('energy_decisions').insert({ project_id: projectId, optimization_run_id: optimizationRunId, model_version: result.modelVersion, summary: result.summary, confidence: result.confidence, recommendations: result.recommendations, limitations: result.limitations }).select('id, project_id, optimization_run_id, model_version, summary, confidence, recommendations, limitations, created_at').single();
    if (saveError) return NextResponse.json({ error: saveError.message }, { status: 400 });
    return NextResponse.json({ decision: saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid decision request' }, { status: 400 });
  }
}
