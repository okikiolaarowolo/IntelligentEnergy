import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { runInvestigationTool, runOptimizationTool, verifyClaims } from '@/lib/energy-investigation-tools';
import type { InvestigationInput } from '@/lib/energy-investigation-agent';

export const runtime = 'nodejs';
export const maxDuration = 30;

type ChatMessage = { role: string; content?: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>; tool_call_id?: string; name?: string };
type ToolCallResult = { toolResultId: string; toolName: string; status: string; units: Record<string, string>; assumptions: string[]; warnings: string[]; data: unknown };

const tools = [
  {
    type: 'function',
    function: {
      name: 'investigate_energy_profile',
      description: 'Run deterministic evidence-first investigation on the supplied profile and optimizer result. Never do arithmetic yourself; cite the returned toolResultId in report claims.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Why this tool is relevant to the current investigation.' },
        },
        required: ['reason'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'optimize_energy_scenario',
      description: 'Run deterministic battery optimization using the exact user-supplied scenario. Returns grid import, curtailment, schedule, and assumptions.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Why this tool is relevant to the current investigation.' },
        },
        required: ['reason'],
        additionalProperties: false,
      },
    },
  },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Authentication is not configured on this deployment.' }, { status: 503 });
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) {
        values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to run an investigation.' }, { status: 401 });

  const apiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: 'The AI agent is not configured yet. Add AI_GATEWAY_API_KEY (recommended) or OPENAI_API_KEY as a server-side environment variable.',
      code: 'AI_PROVIDER_NOT_CONFIGURED',
    }, { status: 503 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  if (!isRecord(body)) return NextResponse.json({ error: 'Request body must be an object.' }, { status: 400 });

  const arrays = ['generationForecastKwh', 'demandForecastKwh'];
  for (const key of arrays) {
    const values = body[key];
    if (!Array.isArray(values) || values.length < 1 || values.length > 48 ||
      values.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0)) {
      return NextResponse.json({ error: key + ' must contain 1–48 finite, non-negative numbers.' }, { status: 400 });
    }
  }
  if ((body.generationForecastKwh as unknown[]).length !== (body.demandForecastKwh as unknown[]).length) {
    return NextResponse.json({ error: 'Generation and demand horizons must match.' }, { status: 400 });
  }

  const generationForecastKwh = body.generationForecastKwh as number[];
  const demandForecastKwh = body.demandForecastKwh as number[];
  const batteryCapacityKwh = body.batteryCapacityKwh;
  const initialSocKwh = body.initialSocKwh;
  const chargeEfficiency = body.chargeEfficiency;
  const dischargeEfficiency = body.dischargeEfficiency;
  const qualityScore = body.qualityScore;
  const warnings = Array.isArray(body.warnings) ? body.warnings.filter((x): x is string => typeof x === 'string').slice(0, 3) : [];

  if ([batteryCapacityKwh, initialSocKwh, chargeEfficiency, dischargeEfficiency].some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
    return NextResponse.json({ error: 'Battery capacity, initial state of charge, and efficiencies must be finite numbers.' }, { status: 400 });
  }
  if ((batteryCapacityKwh as number) < 0 || (initialSocKwh as number) < 0 || (initialSocKwh as number) > (batteryCapacityKwh as number) ||
      (chargeEfficiency as number) <= 0 || (chargeEfficiency as number) > 1 ||
      (dischargeEfficiency as number) <= 0 || (dischargeEfficiency as number) > 1) {
    return NextResponse.json({ error: 'Battery capacity/state of charge or efficiency values are outside supported bounds.' }, { status: 400 });
  }
  if (qualityScore !== undefined && (typeof qualityScore !== 'number' || !Number.isFinite(qualityScore) || qualityScore < 0 || qualityScore > 100)) {
    return NextResponse.json({ error: 'qualityScore must be between 0 and 100.' }, { status: 400 });
  }

  const runId = crypto.randomUUID();
  const context = { runId, datasetId: typeof body.datasetId === 'string' ? body.datasetId.slice(0, 100) : 'ad-hoc-profile' };
  const optimization = runOptimizationTool(context, {
    generationForecastKwh, demandForecastKwh,
    batteryCapacityKwh: batteryCapacityKwh as number,
    initialSocKwh: initialSocKwh as number,
    chargeEfficiency: chargeEfficiency as number,
    dischargeEfficiency: dischargeEfficiency as number,
  });
  if (optimization.status !== 'ok' || !optimization.data) {
    return NextResponse.json({ error: 'The deterministic optimizer rejected this scenario.', details: optimization.warnings }, { status: 400 });
  }

  const investigationInput: InvestigationInput = {
    forecastDemandKwh: demandForecastKwh,
    forecastGenerationKwh: generationForecastKwh,
    optimization: optimization.data,
    dataQuality: { qualityScore: qualityScore as number | undefined, warnings },
  };
  const investigation = runInvestigationTool(context, investigationInput);
  const ledger = new Map<string, ToolCallResult>([[optimization.toolResultId, optimization as ToolCallResult]]);
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are IntelligentEnergy, an evidence-first energy investigation assistant. Use tools for all energy calculations; never calculate or invent numbers yourself. You may call tools to inspect deterministic results. The supplied profile has no timestamps, source-level fuel readings, tariff, or site schedule unless explicitly stated; never claim generator overuse, night baseload, physical faults, or naira savings from absent evidence. Distinguish observed input facts, optimizer scenario estimates, assumptions, and unknowns. Final response must be concise JSON with keys summary, findings (array of {title, explanation, severity, confidence, toolResultIds, nextStep}), missingData (array), and limitations (array). Every material finding must cite a valid toolResultId. This system is advisory-only and must never instruct hardware control.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'Investigate this energy scenario. Plan your checks, call the relevant deterministic tools, inspect their evidence, and return a structured report.',
        inputs: { generationForecastKwh, demandForecastKwh, batteryCapacityKwh, initialSocKwh, chargeEfficiency, dischargeEfficiency, qualityScore: qualityScore ?? null, warnings },
        precomputedOptimizationResultId: optimization.toolResultId,
      }),
    },
  ];

  const baseUrl = process.env.AI_GATEWAY_BASE_URL ?? 'https://ai-gateway.vercel.sh/v1';
  const model = process.env.ENERGY_AGENT_MODEL ?? 'openai/gpt-4o-mini';
  let finalText = '';
  let rounds = 0;
  try {
    for (; rounds < 4; rounds += 1) {
      const response = await fetch(baseUrl.replace(/\/$/, '') + '/chat/completions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        const errorText = (await response.text()).slice(0, 500);
        console.error('Energy agent provider error', response.status, errorText);
        return NextResponse.json({ error: 'The AI provider request failed. Check the configured model and server-side API key.', code: 'AI_PROVIDER_ERROR' }, { status: 502 });
      }
      const completion: unknown = await response.json();
      if (!isRecord(completion) || !Array.isArray(completion.choices) || !isRecord(completion.choices[0])) {
        return NextResponse.json({ error: 'The AI provider returned an unexpected response.' }, { status: 502 });
      }
      const message = completion.choices[0].message;
      if (!isRecord(message)) return NextResponse.json({ error: 'The AI provider response did not contain a message.' }, { status: 502 });
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: typeof message.content === 'string' ? message.content : null,
        tool_calls: Array.isArray(message.tool_calls) ? message.tool_calls as ChatMessage['tool_calls'] : undefined,
      };
      messages.push(assistantMessage);

      if (assistantMessage.tool_calls?.length) {
        for (const call of assistantMessage.tool_calls) {
          let result: ToolCallResult;
          if (call.function.name === 'optimize_energy_scenario') {
            result = optimization as ToolCallResult;
          } else if (call.function.name === 'investigate_energy_profile') {
            result = investigation as ToolCallResult;
          } else {
            result = {
              toolResultId: runId + ':unknown-tool',
              toolName: call.function.name,
              status: 'invalid_input',
              units: {},
              assumptions: [],
              warnings: ['Tool is not available in this agent version.'],
              data: null,
            };
          }
          ledger.set(result.toolResultId, result);
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      finalText = assistantMessage.content ?? '';
      break;
    }
  } catch (error) {
    console.error('Energy agent request failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'The AI investigation could not complete. Try again shortly.', code: 'AI_AGENT_FAILED' }, { status: 502 });
  }

  if (!finalText) return NextResponse.json({ error: 'The agent did not produce a final report within the tool-call limit.' }, { status: 502 });

  let report: unknown;
  try {
    const normalized = finalText.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    report = JSON.parse(normalized);
  } catch {
    return NextResponse.json({ error: 'The agent response was not valid structured JSON. No report was accepted.', code: 'INVALID_AGENT_OUTPUT' }, { status: 502 });
  }
  if (!isRecord(report) || typeof report.summary !== 'string' || !Array.isArray(report.findings) ||
      !Array.isArray(report.missingData) || !Array.isArray(report.limitations)) {
    return NextResponse.json({ error: 'The agent report did not match the required schema.' }, { status: 502 });
  }

  const claims = report.findings.map((finding, index) => {
    if (!isRecord(finding)) return { claimId: 'finding-' + index, text: 'Malformed finding', toolResultIds: [] as string[] };
    return {
      claimId: 'finding-' + index,
      text: typeof finding.explanation === 'string' ? finding.explanation : '',
      toolResultIds: Array.isArray(finding.toolResultIds) ? finding.toolResultIds.filter((id): id is string => typeof id === 'string') : [],
    };
  });
  const verified = verifyClaims(claims, [...ledger.keys()]);
  const blockedClaims = verified.filter((claim) => claim.status !== 'verified');
  const safeFindings = report.findings.filter((finding, index) => isRecord(finding) && verified[index]?.status === 'verified');
  const reportReady = {
    runId,
    agentModel: model,
    agentMode: 'llm-tool-calling',
    roundsUsed: rounds + 1,
    summary: report.summary,
    findings: safeFindings,
    blockedClaims,
    missingData: report.missingData.filter((value) => typeof value === 'string').slice(0, 12),
    limitations: [...report.limitations.filter((value) => typeof value === 'string').slice(0, 12), 'Naira savings are not estimated without supplied tariffs, fuel rates, and source-specific readings.'],
    toolResults: [...ledger.values()],
    verifier: { passed: blockedClaims.length === 0, verifiedFindings: safeFindings.length, blockedFindings: blockedClaims.length },
  };
  return NextResponse.json(reportReady);
}
