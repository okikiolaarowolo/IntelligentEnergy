import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createRawApiKey, hashApiKey } from '@/lib/platform-api';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, project_id, name, key_prefix, created_at, last_used_at, revoked_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json() as { projectId?: string; name?: string };
    const projectId = body.projectId?.trim();
    const name = body.name?.trim();
    if (!projectId || !name) return NextResponse.json({ error: 'projectId and name are required' }, { status: 400 });
    if (name.length > 80) return NextResponse.json({ error: 'Key name must be 80 characters or fewer' }, { status: 400 });

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('owner_user_id', user.id)
      .maybeSingle();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const rawKey = createRawApiKey();
    const { data: key, error } = await supabase
      .from('api_keys')
      .insert({
        project_id: projectId,
        name,
        key_prefix: rawKey.slice(0, 16),
        key_hash: hashApiKey(rawKey),
      })
      .select('id, project_id, name, key_prefix, created_at')
      .single();
    if (error) throw error;

    return NextResponse.json({ key, secret: rawKey, warning: 'Copy this secret now. It is not stored in plaintext and cannot be shown again.' }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create API key' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { data: key } = await supabase
    .from('api_keys')
    .select('id, project_id')
    .eq('id', id)
    .maybeSingle();
  if (!key) return NextResponse.json({ error: 'API key not found' }, { status: 404 });

  const { error } = await supabase.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
