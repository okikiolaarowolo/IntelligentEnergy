'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useRouter } from 'next/navigation';

type Project = { id: string; name: string };
type Baseline = { generationKwh: number; demandKwh: number; directGenerationToLoadKwh: number; gridImportKwh: number; curtailedKwh: number; renewableUtilizationPercent: number; gridDependencyPercent: number; averageDemandKwh: number; averageGenerationKwh: number; peakDemandKwh: number; peakGenerationKwh: number; observations: number };
type PilotDataset = { id: string; name: string; source_filename: string; row_count: number; start_timestamp: string; end_timestamp: string; interval_minutes: number; baseline_snapshot: Baseline; created_at: string };
type Observation = { timestamp: string; demand_kwh: number; generation_kwh: number };

export default function PilotPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [datasets, setDatasets] = useState<PilotDataset[]>([]);
  const [projectId, setProjectId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [selected, setSelected] = useState<{ dataset: PilotDataset; observations: Observation[] } | null>(null);
  const [name, setName] = useState('Real-world pilot import');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

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

  async function loadDatasets(id: string) {
    if (!id) { setDatasets([]); setSelectedId(''); setSelected(null); return; }
    const data = await api(`/api/pilot/datasets?projectId=${encodeURIComponent(id)}`);
    setDatasets(data);
    setSelectedId((current) => data.some((item: PilotDataset) => item.id === current) ? current : data[0]?.id ?? '');
  }

  async function loadDataset(id: string) {
    if (!id) { setSelected(null); return; }
    const data = await api(`/api/pilot/datasets/${encodeURIComponent(id)}`);
    setSelected(data);
  }

  useEffect(() => { loadProjects().catch((e) => setError(e.message)); }, []);
  useEffect(() => { loadDatasets(projectId).catch((e) => setError(e.message)); }, [projectId]);
  useEffect(() => { loadDataset(selectedId).catch((e) => setError(e.message)); }, [selectedId]);

  async function importCsv(event: FormEvent) {
    event.preventDefault();
    setError(''); setMessage(''); setBusy(true);
    try {
      if (!projectId) throw new Error('Select a project first');
      if (!file) throw new Error('Choose a CSV file first');
      const form = new FormData();
      form.set('projectId', projectId);
      form.set('name', name);
      form.set('file', file);
      const data = await api('/api/pilot/datasets', { method: 'POST', body: form });
      setMessage(`Imported ${data.dataset.row_count.toLocaleString()} observations successfully.`);
      setFile(null);
      const input = document.getElementById('pilot-csv') as HTMLInputElement | null;
      if (input) input.value = '';
      await loadDatasets(projectId);
      setSelectedId(data.dataset.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Import failed'); } finally { setBusy(false); }
  }

  async function createForecastDataset() {
    if (!selected) return;
    setError(''); setMessage(''); setBusy(true);
    try {
      await api(`/api/pilot/datasets/${encodeURIComponent(selected.dataset.id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create-forecast-dataset' }) });
      setMessage('Forecast dataset created. Prediction Lab can now train on this pilot data.');
      router.push('/dashboard/prediction');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create forecast dataset'); } finally { setBusy(false); }
  }

  async function deleteDataset() {
    if (!selected || !window.confirm('Delete this pilot dataset and all imported observations?')) return;
    setError(''); setMessage(''); setBusy(true);
    try { await api(`/api/pilot/datasets/${encodeURIComponent(selected.dataset.id)}`, { method: 'DELETE' }); await loadDatasets(projectId); setSelected(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to delete dataset'); }
    finally { setBusy(false); }
  }

  const chartData = useMemo(() => {
    if (!selected) return [];
    const rows = selected.observations;
    const stride = Math.max(1, Math.ceil(rows.length / 300));
    return rows.filter((_, index) => index % stride === 0).map((row, index) => ({
      step: index + 1,
      timestamp: new Date(row.timestamp).toLocaleString(),
      demand: row.demand_kwh,
      generation: row.generation_kwh,
    }));
  }, [selected]);

  const baseline = selected?.dataset.baseline_snapshot;

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  return <>
    <nav className="nav"><strong>IntelligentEnergy</strong><div className="actions"><button onClick={() => router.push('/dashboard')}>Dashboard</button><button onClick={() => router.push('/dashboard/prediction')}>Prediction Lab</button><button onClick={() => router.push('/dashboard/optimization')}>Optimization Lab</button></div></nav>
    <main className="container">
      <header><h1>Real-World Pilot</h1><p>Phase 5A imports validated energy data, establishes a transparent baseline, and hands clean pilot observations into the forecasting pipeline. No real-world equipment is controlled by this feature.</p></header>
      {error && <div className="error" role="alert">{error}</div>}
      {message && <div className="card" role="status"><strong>{message}</strong></div>}

      <section className="card form-card"><h2>Import pilot CSV</h2><p className="muted">Required columns: <code>timestamp,demand_kwh,generation_kwh</code>. Use a consistent time interval and at least 12 observations. Maximum 10,000 rows / 5 MB.</p><form onSubmit={importCsv} className="form-grid"><label>Project<select value={projectId} onChange={(e) => setProjectId(e.target.value)} required><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>Dataset name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required /></label><label>CSV file<input id="pilot-csv" type="file" accept=".csv,text/csv" onChange={handleFile} required /></label><button disabled={busy || !projectId || !file}>{busy ? 'Importing…' : 'Import and validate CSV'}</button></form></section>

      <div className="grid grid-2 form-card"><section className="card"><h2>Imported datasets</h2>{datasets.length === 0 ? <p>No pilot datasets yet.</p> : <div className="history">{datasets.map((dataset) => <button key={dataset.id} onClick={() => setSelectedId(dataset.id)}>{dataset.name}<br /><span className="muted">{dataset.row_count.toLocaleString()} rows · {new Date(dataset.start_timestamp).toLocaleDateString()} → {new Date(dataset.end_timestamp).toLocaleDateString()}</span></button>)}</div>}</section><section className="card"><h2>What Phase 5A proves</h2><p>1. Real data can be ingested with provenance and validation.</p><p>2. Baseline demand, renewable generation, grid import, and curtailment can be measured before optimization.</p><p>3. The same clean observations can be promoted into Phase 3 forecasting.</p></section></div>

      {selected && baseline && <>
        <section className="card form-card"><div className="actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}><div><h2 style={{ marginBottom: 4 }}>{selected.dataset.name}</h2><p className="muted">{selected.dataset.source_filename} · {selected.dataset.row_count.toLocaleString()} observations · {selected.dataset.interval_minutes} minute interval</p></div><div className="actions"><button onClick={createForecastDataset} disabled={busy}>Use for forecasting</button><button className="danger" onClick={deleteDataset} disabled={busy}>Delete</button></div></div></section>
        <section className="card form-card"><h2>Baseline before battery optimization</h2><div className="metrics"><div className="metric"><span>Total demand</span><strong>{baseline.demandKwh.toFixed(3)} kWh</strong></div><div className="metric"><span>Renewable generation</span><strong>{baseline.generationKwh.toFixed(3)} kWh</strong></div><div className="metric"><span>Grid import</span><strong>{baseline.gridImportKwh.toFixed(3)} kWh</strong></div><div className="metric"><span>Curtailed energy</span><strong>{baseline.curtailedKwh.toFixed(3)} kWh</strong></div><div className="metric"><span>Renewable utilization</span><strong>{baseline.renewableUtilizationPercent.toFixed(1)}%</strong></div><div className="metric"><span>Grid dependency</span><strong>{baseline.gridDependencyPercent.toFixed(1)}%</strong></div><div className="metric"><span>Peak demand</span><strong>{baseline.peakDemandKwh.toFixed(3)} kWh</strong></div><div className="metric"><span>Peak generation</span><strong>{baseline.peakGenerationKwh.toFixed(3)} kWh</strong></div></div></section>
        <div className="grid grid-2 form-card"><section className="card chart-card"><h2>Historical demand vs generation</h2><ResponsiveContainer width="100%" height={320}><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="step" /><YAxis /><Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.timestamp ?? ''} /><Legend /><Line type="monotone" dataKey="demand" name="Demand (kWh)" dot={false} /><Line type="monotone" dataKey="generation" name="Generation (kWh)" dot={false} /></LineChart></ResponsiveContainer></section><section className="card chart-card"><h2>Baseline energy balance</h2><ResponsiveContainer width="100%" height={320}><BarChart data={[{ name: 'Energy', demand: baseline.demandKwh, generation: baseline.generationKwh, grid: baseline.gridImportKwh, curtailed: baseline.curtailedKwh }]}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Bar dataKey="demand" name="Demand" /><Bar dataKey="generation" name="Generation" /><Bar dataKey="grid" name="Grid import" /><Bar dataKey="curtailed" name="Curtailed" /></BarChart></ResponsiveContainer></section></div>
        <section className="card form-card"><h2>Data quality</h2><p>✓ Timestamps are unique and evenly spaced.</p><p>✓ Demand and generation values are finite and non-negative.</p><p>✓ Imported source filename and time range are retained for provenance.</p><p>✓ Baseline metrics are calculated before any prediction or optimization.</p></section>
      </>}
    </main>
  </>;
}
