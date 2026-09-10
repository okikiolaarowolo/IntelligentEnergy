import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const { data, error } = await supabase.from('pilot_evaluations').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 });
  const { data: project } = await supabase.from('projects').select('id').eq('id', data.project_id).eq('owner_user_id', user.id).maybeSingle();
  if (!project) return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 });
  return NextResponse.json(data);
}
