import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const API_KEY_PREFIX = 'ie_live_';
const DAILY_LIMIT = 1000;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for the platform API');
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function hashApiKey(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function createRawApiKey() {
  return `${API_KEY_PREFIX}${randomBytes(24).toString('hex')}`;
}

export async function authenticateApiKey(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const rawKey = authorization.slice('Bearer '.length).trim();
  if (!rawKey.startsWith(API_KEY_PREFIX)) return null;

  const supabase = adminClient();
  const { data: key, error } = await supabase
    .from('api_keys')
    .select('id, project_id, key_prefix, revoked_at')
    .eq('key_hash', hashApiKey(rawKey))
    .is('revoked_at', null)
    .maybeSingle();
  if (error || !key) return null;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count }, { data: oldestUsage }] = await Promise.all([
    supabase.from('api_usage').select('id', { count: 'exact', head: true }).eq('api_key_id', key.id).gte('created_at', since),
    supabase.from('api_usage').select('created_at').eq('api_key_id', key.id).gte('created_at', since).order('created_at', { ascending: true }).limit(1).maybeSingle(),
  ]);
  const used = count ?? 0;
  const resetAt = oldestUsage?.created_at
    ? new Date(new Date(oldestUsage.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  if (used >= DAILY_LIMIT) return { ...key, rateLimited: true, remaining: 0, resetAt };
  return { ...key, rateLimited: false, remaining: Math.max(0, DAILY_LIMIT - used - 1), resetAt };
}

export async function recordApiUsage(apiKeyId: string, projectId: string, endpoint: string, statusCode: number) {
  const supabase = adminClient();
  await Promise.all([
    supabase.from('api_usage').insert({ api_key_id: apiKeyId, project_id: projectId, endpoint, status_code: statusCode }),
    supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', apiKeyId),
  ]);
}

export function rateLimitHeaders(remaining: number, resetAt: string) {
  return {
    'X-RateLimit-Limit': String(DAILY_LIMIT),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': resetAt,
  };
}
