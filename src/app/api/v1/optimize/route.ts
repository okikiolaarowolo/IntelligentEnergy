import { NextResponse } from 'next/server';
import { optimizeEnergy, type OptimizationInput } from '@/lib/optimizer';
import { authenticateApiKey, rateLimitHeaders, recordApiUsage } from '@/lib/platform-api';

const endpoint = '/api/v1/optimize';

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  if (auth.rateLimited) return NextResponse.json({ error: 'Daily API request limit reached' }, { status: 429, headers: rateLimitHeaders(0, auth.resetAt) });

  let statusCode = 200;
  try {
    const body = await request.json() as OptimizationInput;
    const result = optimizeEnergy(body);
    return NextResponse.json({ result }, { headers: rateLimitHeaders(auth.remaining, auth.resetAt) });
  } catch (error) {
    statusCode = 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Optimization failed' }, { status: statusCode, headers: rateLimitHeaders(auth.remaining, auth.resetAt) });
  } finally {
    await recordApiUsage(auth.id, auth.project_id, endpoint, statusCode);
  }
}
