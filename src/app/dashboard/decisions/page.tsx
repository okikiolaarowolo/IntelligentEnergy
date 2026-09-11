'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Project = { id: string; name: string };
type Run = { id: string; model_version: string; horizon_steps: number; objective_cost: number; created_at: string };
type Recommendation = { id: string; priority: 'high'|'medium'|'low'; action: string; reason: string; expectedImpact: string; evidence: string[]; confidence: 'high'|'medium'|'low' };
type Decision = { id: string; summary: string; confidence: 'high'|'medium'|'low'; recommendations: Recommendation[]; limitations: string[]; created_at: string };

export default function DecisionsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [projectId, setProjectId] = useState('');
  const [runId, setRunId] = useState('');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [history, setHistory] = useState<Decision[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadProjects() { const r = await fetch('/api/projects'); if (!r.ok) throw new Error('Unable to load projects'); const data = await r.json() as Project[]; setProjects(data); if (data[0]) setProjectId(data[0].id); }
  async function loadRuns(id: string) { const r = await fetch(`/api/optimization?projectId=${encodeURIComponent(id)}`); if (!r.ok) throw new Error('Unable to load optimization runs'); const data = await r.json() as Run[]; setRuns(data); setRunId(data[0]?.id ?? ''); }
  async function loadHistory(id: string) { const r = await fetch(`/api/decisions?projectId=${encodeURIComponent(id)}`); if (!r.ok) throw new Error('Unable to load decision history'); setHistory(await r.json()); }
  useEffect(() => { loadProjects().catch((e) => setError(e.message)); }, []);
  useEffect(() => { if (!projectId) return; setError(''); Promise.all([loadRuns(projectId), loadHistory(projectId)]).catch((e) => setError(e.message)); }, [projectId]);
  async function generate() { setBusy(true); setError(''); try { if (!projectId || !runId) throw new Error('Create an optimization run first'); const r = await fetch('/api/decisions', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ projectId, optimizationRunId: runId }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Decision generation failed'); setDecision(data.decision); setHistory((h) => [data.decision, ...h]); } catch (e) { setError(e instanceof Error ? e.message : 'Decision generation failed'); } finally { setBusy(false); } }

  return <><nav className="nav"><strong>IntelligentEnergy</strong><button onClick={() => router.push('/dashboard')}>Back to dashboard</button></nav><main className="container"><header><h1>Decision Center</h1><p>Phase 7 turns forecast and optimization outputs into explainable, advisory energy recommendations.</p></header>{error && <div className="error" role="alert">{error}</div>}<section className="card"><h2>Generate recommendation</h2><div className="form-grid"><label>Project<select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">Select project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Optimization run<select value={runId} onChange={e=>setRunId(e.target.value)}><option value="">Select optimization</option>{runs.map(r=><option key={r.id} value={r.id}>{r.model_version} · {r.horizon_steps} steps · {new Date(r.created_at).toLocaleString()}</option>)}</select></label><button onClick={generate} disabled={busy || !runId}>{busy ? 'Analyzing…' : 'Generate recommendations'}</button></div></section>{decision && <><section className="card"><h2>Decision summary</h2><div className="metrics"><div className="metric"><span>Confidence</span><strong>{decision.confidence}</strong></div><div className="metric"><span>Recommendations</span><strong>{decision.recommendations.length}</strong></div></div><p>{decision.summary}</p></section><section className="card"><h2>What the system recommends</h2>{decision.recommendations.map(r=><article key={r.id} className="card"><p><strong>{r.priority.toUpperCase()} · {r.action}</strong></p><p>{r.reason}</p><p><strong>Expected impact:</strong> {r.expectedImpact}</p><p className="muted"><strong>Evidence:</strong> {r.evidence.join(' ')}</p></article>)}</section><section className="card"><h2>Limitations & safety boundary</h2><ul>{decision.limitations.map((x,i)=><li key={i}>{x}</li>)}</ul></section></>}{history.length > 0 && <section className="card"><h2>Decision history</h2><div className="table-wrap"><table><thead><tr><th>Created</th><th>Confidence</th><th>Summary</th></tr></thead><tbody>{history.slice(0,10).map(d=><tr key={d.id}><td>{new Date(d.created_at).toLocaleString()}</td><td>{d.confidence}</td><td>{d.summary}</td></tr>)}</tbody></table></div></section>}</main></>;
}
