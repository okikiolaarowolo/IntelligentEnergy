'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Project = { id: string; name: string; description: string | null };
type OptimizationRun = { id: string; model_version: string; horizon_steps: number; objective_cost: number; created_at: string; result_snapshot?: { totals?: { gridImportKwh?: number; curtailedKwh?: number; batteryChargeInputKwh?: number; batteryDischargeDeliveredKwh?: number } } };
type Decision = { id: string; summary: string; confidence: 'high'|'medium'|'low'; recommendations: Array<{ priority: string; action: string; expectedImpact: string }>; created_at: string };

export default function OverviewPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [runs, setRuns] = useState<OptimizationRun[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError('');
    try {
      const projectResponse = await fetch('/api/projects');
      if (!projectResponse.ok) throw new Error('Unable to load projects');
      const projectData = await projectResponse.json() as Project[];
      setProjects(projectData);
      const selected = projectData.find((p) => p.id === projectId) ?? projectData[0];
      setProjectId(selected?.id ?? '');
      if (!selected) { setRuns([]); setDecisions([]); return; }
      const [runResponse, decisionResponse] = await Promise.all([
        fetch(`/api/optimization?projectId=${encodeURIComponent(selected.id)}`),
        fetch(`/api/decisions?projectId=${encodeURIComponent(selected.id)}`),
      ]);
      if (!runResponse.ok || !decisionResponse.ok) throw new Error('Unable to load intelligence results');
      setRuns(await runResponse.json() as OptimizationRun[]);
      setDecisions(await decisionResponse.json() as Decision[]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load overview'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function changeProject(id: string) {
    setProjectId(id); setError('');
    if (!id) return;
    try {
      const [runResponse, decisionResponse] = await Promise.all([
        fetch(`/api/optimization?projectId=${encodeURIComponent(id)}`),
        fetch(`/api/decisions?projectId=${encodeURIComponent(id)}`),
      ]);
      if (!runResponse.ok || !decisionResponse.ok) throw new Error('Unable to load project intelligence');
      setRuns(await runResponse.json() as OptimizationRun[]);
      setDecisions(await decisionResponse.json() as Decision[]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load project'); }
  }

  const latestRun = runs[0];
  const latestDecision = decisions[0];
  const totals = latestRun?.result_snapshot?.totals;

  return <>
    <nav className="nav"><strong>IntelligentEnergy</strong><div className="actions"><button onClick={() => router.push('/dashboard')}>Dashboard</button><button onClick={() => router.push('/dashboard/pilot')}>Pilot</button><button onClick={() => router.push('/dashboard/prediction')}>Prediction</button><button onClick={() => router.push('/dashboard/optimization')}>Optimization</button><button onClick={() => router.push('/dashboard/decisions')}>Decisions</button></div></nav>
    <main className="container">
      <header><h1>Energy Intelligence Overview</h1><p>One view of the full IntelligentEnergy pipeline: data, prediction, optimization, evaluation, and explainable decisions.</p></header>
      {error && <div className="error" role="alert">{error}</div>}
      <section className="card"><label>Project<select value={projectId} onChange={(e) => changeProject(e.target.value)}><option value="">Select project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></section>
      {loading ? <section className="card"><p>Loading intelligence summary…</p></section> : !projectId ? <section className="card"><h2>Start with a project</h2><p>Create a project and add pilot or forecast data to see the complete energy intelligence workflow.</p><button onClick={() => router.push('/dashboard')}>Open dashboard</button></section> : <>
        <section className="grid grid-3">
          <article className="card"><h2>Predict</h2><p>Forecast demand and renewable generation using the Prediction Lab.</p><button onClick={() => router.push('/dashboard/prediction')}>Open Prediction Lab</button></article>
          <article className="card"><h2>Optimize</h2><p>{latestRun ? `Latest run: ${latestRun.horizon_steps} steps using ${latestRun.model_version}.` : 'No optimization run yet.'}</p><button onClick={() => router.push('/dashboard/optimization')}>Open Optimization</button></article>
          <article className="card"><h2>Decide</h2><p>{latestDecision ? `${latestDecision.recommendations.length} explainable recommendations · ${latestDecision.confidence} confidence.` : 'Generate an explainable recommendation from an optimization run.'}</p><button onClick={() => router.push('/dashboard/decisions')}>Open Decision Center</button></article>
        </section>
        <section className="card"><h2>Latest optimization snapshot</h2>{latestRun ? <><div className="metrics"><div className="metric"><span>Grid import</span><strong>{Number(totals?.gridImportKwh ?? 0).toFixed(2)} kWh</strong></div><div className="metric"><span>Curtailment</span><strong>{Number(totals?.curtailedKwh ?? 0).toFixed(2)} kWh</strong></div><div className="metric"><span>Battery charge</span><strong>{Number(totals?.batteryChargeInputKwh ?? 0).toFixed(2)} kWh</strong></div><div className="metric"><span>Battery discharge</span><strong>{Number(totals?.batteryDischargeDeliveredKwh ?? 0).toFixed(2)} kWh</strong></div></div><p className="muted">Run {latestRun.model_version} · {new Date(latestRun.created_at).toLocaleString()}</p></> : <p>No optimization results are available yet.</p>}</section>
        <section className="card"><h2>Latest decision</h2>{latestDecision ? <><p>{latestDecision.summary}</p><p><strong>Confidence:</strong> {latestDecision.confidence}</p><ul>{latestDecision.recommendations.slice(0, 3).map((r, i) => <li key={i}><strong>{r.priority.toUpperCase()}:</strong> {r.action} — {r.expectedImpact}</li>)}</ul></> : <p>No decision has been generated yet. Run an optimization, then open Decision Center.</p>}</section>
        <section className="card"><h2>System boundaries</h2><p>This dashboard summarizes analytical and advisory outputs. IntelligentEnergy does not directly control batteries, inverters, appliances, or the electrical grid.</p><p className="muted">Forecasts and recommendations depend on input data and modeling assumptions. They are decision support, not guarantees of real-world performance.</p></section>
      </>}
    </main>
  </>;
}
