import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const scenarioId = params.get('scenarioId');
  const limit = Math.min(Math.max(Number(params.get('limit') ?? 20) || 20, 1), 100);

  let query = supabase
    .from('simulation_runs')
    .select('id, scenario_id, status, simulator_version, input_snapshot, result_snapshot, error_message, created_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (scenarioId) query = query.eq('scenario_id', scenarioId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
