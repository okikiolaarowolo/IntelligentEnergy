'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useRouter } from 'next/navigation';

type Project = { id: string; name: string; description: string | null };
type Scenario = { id: string; project_id: string; name: string; generation_profile: number[]; demand_profile: number[]; battery_capacity_kwh: number; initial_soc_kwh: number; charge_efficiency: number; discharge_efficiency: number };
type Run = { id: string; scenario_id: string; status: string; simulator_version: string; input_snapshot: unknown; result_snapshot: Result; created_at: string; completed_at: string | null };
type Step = { generation: number; demand: number; directGenerationToLoad: number; batteryChargeInput: number; batteryDischargeDelivered: number; curtailed: number; unmet: number; socKwh: number };
type Result = { steps: Step[]; totals: { generation: number; demand: number; directGenerationToLoad: number; batteryChargeInput: number; batteryDischargeDelivered: number; curtailed: number; unmet: number; finalSocKwh: number } };

const DEFAULT_GENERATION = '5,5,2,8';
const DEFAULT_DEMAND = '4,6,5,4';

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [projectId, setProjectId] = useState('');
  const [scenarioId, setScenarioId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [scenarioName, setScenarioName] = useState('My first scenario');
  const [generation, setGeneration] = useState(DEFAULT_GENERATION);
  const [demand, setDemand] = useState(DEFAULT_DEMAND);
  const [capacity, setCapacity] = useState('5');
  const [soc, setSoc] = useState('2');
  const [chargeEfficiency, setChargeEfficiency] = useState('0.9');
  const [dischargeEfficiency, setDischargeEfficiency] = useState('0.9');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const selectedScenario = scenarios.find((s) => s.id === scenarioId);
  const chartData = useMemo(() => result?.steps.map((s, i) => ({ step: i + 1, generation: s.generation, demand: s.demand, soc: s.socKwh })) ?? [], [result]);

  async function api(url: string, options?: RequestInit) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || 'Request failed');
    return data;
  }

  async function loadProjects() {
    const data = await api('/api/projects');
    setProjects(data);
    if (!projectId && data[0]) setProjectId(data[0].id);
  }

  async function loadScenarios(id: string) {
    if (!id) { setScenarios([]); setScenarioId(''); return; }
    const data = await api(`/api/scenarios?projectId=${encodeURIComponent(id)}`);
    setScenarios(data);
    setScenarioId((current) => data.some((s: Scenario) => s.id === current) ? current : data[0]?.id || '');
  }

  async function loadRuns(id = scenarioId) {
    if (!id) { setRuns([]); return; }
    setRuns(await api(`/api/runs?scenarioId=${encodeURIComponent(id)}&limit=25`));
  }

  useEffect(() => { loadProjects().catch((e) => setError(e.message)); }, []);
  useEffect(() => { loadScenarios(projectId).catch((e) => setError(e.message)); }, [projectId]);
  useEffect(() => { if (scenarioId) loadRuns(scenarioId).catch((e) => setError(e.message)); }, [scenarioId]);

  function parseProfile(value: string, label: string) {
    const values = value.split(',').map((v) => Number(v.trim()));
    if (!values.length || values.some((v) => !Number.isFinite(v) || v < 0)) throw new Error(`${label} must be comma-separated non-negative numbers`);
    return values;
  }

  async function createProject(e: FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const project = await api('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: projectName }) });
      setProjects((p) => [project, ...p]); setProjectId(project.id); setProjectName('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create project'); } finally { setBusy(false); }
  }

  async function createScenario(e: FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (!projectId) throw new Error('Create or select a project first');
      const body = { projectId, name: scenarioName, generationProfile: parseProfile(generation, 'Generation profile'), demandProfile: parseProfile(demand, 'Demand profile'), batteryCapacityKwh: Number(capacity), initialSocKwh: Number(soc), chargeEfficiency: Number(chargeEfficiency), dischargeEfficiency: Number(dischargeEfficiency) };
      if (body.generationProfile.length !== body.demandProfile.length) throw new Error('Generation and demand profiles must have equal length');
      const scenario = await api('/api/scenarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await loadScenarios(projectId); setScenarioId(scenario.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create scenario'); } finally { setBusy(false); }
  }

  async function runScenario(id = scenarioId) {
    setError(''); setBusy(true);
    try {
      if (!id) throw new Error('Select a scenario first');
      const out = await api('/api/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: id }) });
      setResult(out.result); await loadRuns(id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Simulation failed'); } finally { setBusy(false); }
  }

  async function deleteScenario(id: string) {
    if (!window.confirm('Delete this scenario and its simulation history?')) return;
    setError('');
    try { await api(`/api/scenarios/${id}`, { method: 'DELETE' }); await loadScenarios(projectId); setResult(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to delete scenario'); }
  }

  async function deleteProject() {
    if (!projectId || !window.confirm('Delete this project, its scenarios, and simulation history?')) return;
    setError('');
    try { await api(`/api/projects/${projectId}`, { method: 'DELETE' }); const remaining = projects.filter((p) => p.id !== projectId); setProjects(remaining); setProjectId(remaining[0]?.id || ''); setResult(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to delete project'); }
  }

  async function signOut() {
    const { createClient } = await import('@/lib/supabase/browser');
    await createClient().auth.signOut(); router.push('/login'); router.refresh();
  }

  return <>
    <nav className="nav"><strong>IntelligentEnergy</strong><div className="actions"><button onClick={() => router.push('/dashboard/prediction')}>Prediction Lab</button><button onClick={() => router.push('/dashboard/optimization')}>Optimization Lab</button><button onClick={signOut}>Sign out</button></div></nav>
    <main className="container">
      <header><h1>Energy Dashboard</h1><p>Build scenarios, run the deterministic energy simulator, and inspect your results.</p></header>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="grid grid-3">
        <section className="card"><h2>Project</h2><form onSubmit={createProject}><input placeholder="New project name" value={projectName} onChange={(e) => setProjectName(e.target.value)} required maxLength={120} /><button disabled={busy}>Create project</button></form><select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Select project"><option value="">Select project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>{projectId && <button className="danger" onClick={deleteProject}>Delete project</button>}</section>
        <section className="card"><h2>Scenarios</h2><select value={scenarioId} onChange={(e) => { setScenarioId(e.target.value); const s = scenarios.find((x) => x.id === e.target.value); if (s) { setGeneration(s.generation_profile.join(',')); setDemand(s.demand_profile.join(',')); setCapacity(String(s.battery_capacity_kwh)); setSoc(String(s.initial_soc_kwh)); setChargeEfficiency(String(s.charge_efficiency)); setDischargeEfficiency(String(s.discharge_efficiency)); setScenarioName(s.name); } }} aria-label="Select scenario"><option value="">Select scenario</option>{scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>{selectedScenario && <div className="actions"><button onClick={() => runScenario(selectedScenario.id)} disabled={busy}>Run selected</button><button className="danger" onClick={() => deleteScenario(selectedScenario.id)}>Delete</button></div>}</section>
        <section className="card"><h2>Run history</h2>{runs.length === 0 ? <p>No runs yet.</p> : <div className="history">{runs.slice(0, 8).map((run) => <button key={run.id} onClick={() => setResult(run.result_snapshot)}>{new Date(run.created_at).toLocaleString()} · {run.status}</button>)}</div>}</section>
      </div>
      <section className="card form-card"><h2>Create scenario configuration</h2><form onSubmit={createScenario} className="form-grid"><label>Scenario name<input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} maxLength={120} required /></label><label>Generation profile (kWh/step)<input value={generation} onChange={(e) => setGeneration(e.target.value)} /></label><label>Demand profile (kWh/step)<input value={demand} onChange={(e) => setDemand(e.target.value)} /></label><label>Battery capacity (kWh)<input type="number" min="0" step="any" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></label><label>Initial SOC (kWh)<input type="number" min="0" step="any" value={soc} onChange={(e) => setSoc(e.target.value)} /></label><label>Charge efficiency<input type="number" min="0.000001" max="1" step="any" value={chargeEfficiency} onChange={(e) => setChargeEfficiency(e.target.value)} /></label><label>Discharge efficiency<input type="number" min="0.000001" max="1" step="any" value={dischargeEfficiency} onChange={(e) => setDischargeEfficiency(e.target.value)} /></label><button disabled={busy || !projectId}>{busy ? 'Working…' : 'Save new scenario'}</button></form></section>
      {result && <><section className="card"><h2>Simulation results</h2><div className="metrics">{Object.entries(result.totals).map(([key, value]) => <div className="metric" key={key}><span>{key}</span><strong>{Number(value).toFixed(3)} kWh</strong></div>)}</div></section><div className="grid grid-2"><section className="card chart-card"><h2>Generation vs demand</h2><ResponsiveContainer width="100%" height={300}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="step" /><YAxis /><Tooltip /><Legend /><Bar dataKey="generation" name="Generation" /><Bar dataKey="demand" name="Demand" /></BarChart></ResponsiveContainer></section><section className="card chart-card"><h2>Battery state of charge</h2><ResponsiveContainer width="100%" height={300}><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="step" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="soc" name="SOC (kWh)" /></LineChart></ResponsiveContainer></section></div><section className="card"><h2>Time-step detail</h2><div className="table-wrap"><table><thead><tr><th>Step</th><th>Generation</th><th>Demand</th><th>Direct to load</th><th>Charge</th><th>Discharge</th><th>Curtailed</th><th>Unmet</th><th>SOC</th></tr></thead><tbody>{result.steps.map((s, i) => <tr key={i}><td>{i + 1}</td><td>{s.generation.toFixed(3)}</td><td>{s.demand.toFixed(3)}</td><td>{s.directGenerationToLoad.toFixed(3)}</td><td>{s.batteryChargeInput.toFixed(3)}</td><td>{s.batteryDischargeDelivered.toFixed(3)}</td><td>{s.curtailed.toFixed(3)}</td><td>{s.unmet.toFixed(3)}</td><td>{s.socKwh.toFixed(3)}</td></tr>)}</tbody></table></div></section></>}
    </main>
  </>;
}
