import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { optimizeEnergy } from '@/lib/optimizer';

type ForecastRow = { step?: number; demandKwh?: number; generationKwh?: number };

async function getClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function parseForecastRows(value: unknown) {
  if (!Array.isArray(value)) throw new Error('Forecast result is invalid');
  const rows = value as ForecastRow[];
  const demand = rows.map((row, index) => {
    const value = Number(row.demandKwh);
    if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid demand forecast at step ${index + 1}`);
    return value;
  });
  const generation = rows.map((row, index) => {
    const value = Number(row.generationKwh);
    if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid generation forecast at step ${index + 1}`);
    return value;
  });
  return { demand, generation };
}

export async function GET(request: Request) {
  const { supabase, user } = await getClient();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).eq('owner_user_id', user.id).maybeSingle();
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  const { data, error } = await supabase.from('optimization_runs').select('id, project_id, forecast_run_id, model_version, horizon_steps, objective_cost, result_snapshot, created_at').eq('project_id', projectId).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { supabase, user } = await getClient();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const projectId = typeof body.projectId === 'string' ? body.projectId : '';
    const forecastRunId = typeof body.forecastRunId === 'string' ? body.forecastRunId : null;
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

    const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).eq('owner_user_id', user.id).maybeSingle();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    let generationForecastKwh: number[];
    let demandForecastKwh: number[];
    if (forecastRunId) {
      const { data: run, error: runError } = await supabase
        .from('forecast_runs')
        .select('id, result_snapshot, forecast_datasets!inner(project_id)')
        .eq('id', forecastRunId)
        .eq('forecast_datasets.project_id', projectId)
        .maybeSingle();
      if (runError) return NextResponse.json({ error: runError.message }, { status: 400 });
      if (!run) return NextResponse.json({ error: 'Forecast run not found for this project' }, { status: 404 });
      ({ demand: demandForecastKwh, generation: generationForecastKwh } = parseForecastRows(run.result_snapshot));
    } else {
      ({ demand: demandForecastKwh, generation: generationForecastKwh } = parseForecastRows(body.forecasts));
    }

    const result = optimizeEnergy({
      generationForecastKwh,
      demandForecastKwh,
      batteryCapacityKwh: Number(body.batteryCapacityKwh),
      initialSocKwh: Number(body.initialSocKwh),
      chargeEfficiency: Number(body.chargeEfficiency ?? 0.9),
      dischargeEfficiency: Number(body.dischargeEfficiency ?? 0.9),
      gridImportCostPerKwh: body.gridImportCostPerKwh === undefined ? undefined : Number(body.gridImportCostPerKwh),
      curtailmentCostPerKwh: body.curtailmentCostPerKwh === undefined ? undefined : Number(body.curtailmentCostPerKwh),
      batteryThroughputCostPerKwh: body.batteryThroughputCostPerKwh === undefined ? undefined : Number(body.batteryThroughputCostPerKwh),
      terminalSocTargetKwh: body.terminalSocTargetKwh === undefined ? undefined : Number(body.terminalSocTargetKwh),
    });

    const inputSnapshot = {
      generationForecastKwh,
      demandForecastKwh,
      batteryCapacityKwh: Number(body.batteryCapacityKwh),
      initialSocKwh: Number(body.initialSocKwh),
      chargeEfficiency: Number(body.chargeEfficiency ?? 0.9),
      dischargeEfficiency: Number(body.dischargeEfficiency ?? 0.9),
      gridImportCostPerKwh: Number(body.gridImportCostPerKwh ?? 1),
      curtailmentCostPerKwh: Number(body.curtailmentCostPerKwh ?? 0.1),
      batteryThroughputCostPerKwh: Number(body.batteryThroughputCostPerKwh ?? 0.01),
      terminalSocTargetKwh: Number(body.terminalSocTargetKwh ?? body.initialSocKwh),
    };

    const { data: saved, error: saveError } = await supabase.from('optimization_runs').insert({
      project_id: projectId,
      forecast_run_id: forecastRunId,
      model_version: result.modelVersion,
      horizon_steps: result.steps.length,
      input_snapshot: inputSnapshot,
      result_snapshot: result,
      objective_cost: result.objectiveCost,
    }).select('id, project_id, forecast_run_id, model_version, horizon_steps, objective_cost, created_at').single();
    if (saveError) return NextResponse.json({ error: saveError.message }, { status: 400 });
    return NextResponse.json({ run: saved, result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid optimization request' }, { status: 400 });
  }
}
