import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculatePilotBaseline, parsePilotCsv } from '@/lib/pilot';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = new URL(request.url).searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

  const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).eq('owner_user_id', user.id).maybeSingle();
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('pilot_datasets')
    .select('id, name, source_filename, row_count, start_timestamp, end_timestamp, interval_minutes, baseline_snapshot, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const projectId = String(formData.get('projectId') ?? '').trim();
    const name = String(formData.get('name') ?? '').trim();
    const file = formData.get('file');
    if (!projectId || !name || !(file instanceof File)) return NextResponse.json({ error: 'projectId, name, and CSV file are required' }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'CSV file must be 5 MB or smaller' }, { status: 400 });
    if (!file.name.toLowerCase().endsWith('.csv')) return NextResponse.json({ error: 'Only .csv files are supported' }, { status: 400 });

    const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).eq('owner_user_id', user.id).maybeSingle();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const parsed = parsePilotCsv(await file.text());
    const baseline = calculatePilotBaseline(parsed.observations);
    const { data: dataset, error: datasetError } = await supabase
      .from('pilot_datasets')
      .insert({
        project_id: projectId,
        name,
        source_filename: file.name,
        row_count: parsed.observations.length,
        start_timestamp: parsed.observations[0].timestamp,
        end_timestamp: parsed.observations[parsed.observations.length - 1].timestamp,
        interval_minutes: parsed.intervalMinutes,
        baseline_snapshot: baseline,
      })
      .select('id, name, source_filename, row_count, start_timestamp, end_timestamp, interval_minutes, baseline_snapshot, created_at')
      .single();

    if (datasetError || !dataset) return NextResponse.json({ error: datasetError?.message ?? 'Unable to create pilot dataset' }, { status: 400 });

    const rows = parsed.observations.map((observation) => ({
      dataset_id: dataset.id,
      timestamp: observation.timestamp,
      demand_kwh: observation.demandKwh,
      generation_kwh: observation.generationKwh,
    }));

    for (let start = 0; start < rows.length; start += 500) {
      const { error } = await supabase.from('pilot_observations').insert(rows.slice(start, start + 500));
      if (error) {
        await supabase.from('pilot_datasets').delete().eq('id', dataset.id);
        return NextResponse.json({ error: `Unable to store pilot observations: ${error.message}` }, { status: 400 });
      }
    }

    return NextResponse.json({ dataset, warnings: parsed.warnings }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Pilot import failed' }, { status: 400 });
  }
}
