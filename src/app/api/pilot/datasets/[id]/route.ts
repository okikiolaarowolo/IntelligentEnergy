import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;

  const { data: dataset, error: datasetError } = await supabase
    .from('pilot_datasets')
    .select('id, project_id, name, source_filename, row_count, start_timestamp, end_timestamp, interval_minutes, baseline_snapshot, created_at')
    .eq('id', id)
    .maybeSingle();
  if (datasetError) return NextResponse.json({ error: datasetError.message }, { status: 400 });
  if (!dataset) return NextResponse.json({ error: 'Pilot dataset not found' }, { status: 404 });

  const { data: observations, error: observationError } = await supabase
    .from('pilot_observations')
    .select('timestamp, demand_kwh, generation_kwh')
    .eq('dataset_id', id)
    .order('timestamp', { ascending: true })
    .range(0, 9999);
  if (observationError) return NextResponse.json({ error: observationError.message }, { status: 400 });

  return NextResponse.json({ dataset, observations: observations ?? [] });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;

  const { data: dataset } = await supabase.from('pilot_datasets').select('id').eq('id', id).maybeSingle();
  if (!dataset) return NextResponse.json({ error: 'Pilot dataset not found' }, { status: 404 });
  const { error } = await supabase.from('pilot_datasets').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;

  try {
    const body = await request.json() as { action?: string };
    if (body.action !== 'create-forecast-dataset') return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });

    const { data: pilot, error: pilotError } = await supabase.from('pilot_datasets').select('id, project_id, name').eq('id', id).maybeSingle();
    if (pilotError) return NextResponse.json({ error: pilotError.message }, { status: 400 });
    if (!pilot) return NextResponse.json({ error: 'Pilot dataset not found' }, { status: 404 });

    const { data: observations, error: observationError } = await supabase
      .from('pilot_observations')
      .select('timestamp, demand_kwh, generation_kwh')
      .eq('dataset_id', id)
      .order('timestamp', { ascending: true })
      .range(0, 9999);
    if (observationError) return NextResponse.json({ error: observationError.message }, { status: 400 });
    if (!observations || observations.length < 12) return NextResponse.json({ error: 'At least 12 observations are required for forecasting' }, { status: 400 });

    const forecastObservations = observations.map((row) => ({
      timestamp: row.timestamp,
      demandKwh: row.demand_kwh,
      generationKwh: row.generation_kwh,
    }));
    const { data: forecastDataset, error: forecastError } = await supabase
      .from('forecast_datasets')
      .insert({
        project_id: pilot.project_id,
        name: `Pilot · ${pilot.name}`,
        observations: forecastObservations,
      })
      .select('id, name, created_at')
      .single();
    if (forecastError || !forecastDataset) return NextResponse.json({ error: forecastError?.message ?? 'Unable to create forecast dataset' }, { status: 400 });

    return NextResponse.json({ forecastDataset }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create forecast dataset' }, { status: 400 });
  }
}
