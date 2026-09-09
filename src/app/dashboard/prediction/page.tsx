'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Project = { id: string; name: string };
type ForecastSeries = { target: string; metrics: { mae: number; rmse: number; mape: number; baselineMae: number; improvementPercent: number; testSamples: number } };
type ForecastResult = { modelVersion: string; lagCount: number; horizonSteps: number; forecasts: { step: number; demandKwh?: number; generationKwh?: number }[]; series: ForecastSeries[] };

function sampleCsv() {
  const rows = ['timestamp,generation_kwh,demand_kwh'];
  for (let i = 0; i < 48; i += 1) {
    const time = new Date(Date.UTC(2026, 0, 1, i)).toISOString();
    rows.push(`${time},${(2 + Math.max(0, Math.sin((i % 24 - 6) / 24 * Math.PI) * 5).toFixed(2))},${(3 + (i % 8) * 0.35).toFixed(2)}`);
  }
  return rows.join('\n');
}

export default function PredictionPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('My forecasting dataset');
  const [csv, setCsv] = useState(sampleCsv());
  const [horizon, setHorizon] = useState('6');
  const [lag, setLag] = useState('');
  const [target, setTarget] = useState<'both' | 'demand' | 'generation'>('both');
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/projects').then(async (r) => { if (!r.ok) throw new Error('Unable to load projects'); return r.json(); }).then((data: Project[]) => { setProjects(data); if (data[0]) setProjectId(data[0].id); }).catch((e) => setError(e.message));
  }, []);

  function parseCsv(value: string) {
    const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 13) throw new Error('Provide at least 12 historical rows plus a header');
    const header = lines[0].toLowerCase().split(',').map((x) => x.trim());
    const timestampIndex = header.indexOf('timestamp');
    const generationIndex = header.indexOf('generation_kwh');
    const demandIndex = header.indexOf('demand_kwh');
    if (timestampIndex < 0 || generationIndex < 0 || demandIndex < 0) throw new Error('CSV header must contain timestamp,generation_kwh,demand_kwh');
    return lines.slice(1).map((line) => {
      const values = line.split(',').map((x) => x.trim());
      return { timestamp: values[timestampIndex], generationKwh: Number(values[generationIndex]), demandKwh: Number(values[demandIndex]) };
    });
  }

  async function runForecast(e: FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (!projectId) throw new Error('Create a project first');
      const observations = parseCsv(csv);
      const response = await fetch('/api/forecasts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, name, observations, horizonSteps: Number(horizon), lagCount: lag ? Number(lag) : 0, target }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Forecast failed');
      setResult(data.result);
    } catch (e) { setError(e instanceof Error ? e.message : 'Forecast failed'); } finally { setBusy(false); }
  }

  return <><nav className="nav"><strong>IntelligentEnergy</strong><button onClick={() => router.push('/dashboard')}>Back to dashboard</button></nav><main className="container"><header><h1>Prediction Lab</h1><p>Phase 3 forecasts demand and solar generation from historical observations. The model is evaluated on held-out history before future predictions are shown.</p></header>{error && <div className="error" role="alert">{error}</div>}<section className="card"><h2>Historical energy data</h2><form onSubmit={runForecast} className="form-grid"><label>Project<select value={projectId} onChange={(e) => setProjectId(e.target.value)} required><option value="">Select project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Dataset name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} /></label><label>Forecast horizon (steps)<input type="number" min="1" max="48" value={horizon} onChange={(e) => setHorizon(e.target.value)} /></label><label>Lag count (optional)<input type="number" min="2" max="48" value={lag} onChange={(e) => setLag(e.target.value)} placeholder="Auto" /></label><label>Target<select value={target} onChange={(e) => setTarget(e.target.value as typeof target)}><option value="both">Demand + generation</option><option value="demand">Demand only</option><option value="generation">Generation only</option></select></label><label className="full">CSV data<textarea rows={14} value={csv} onChange={(e) => setCsv(e.target.value)} spellCheck={false} /></label><button disabled={busy || !projectId}>{busy ? 'Training…' : 'Train & forecast'}</button></form></section>{result && <><section className="card"><h2>Model evaluation</h2><p><strong>{result.modelVersion}</strong> · {result.lagCount} lags · {result.horizonSteps} future steps</p><div className="metrics">{result.series.map((s) => <div className="metric" key={s.target}><span>{s.target} · MAE / RMSE</span><strong>{s.metrics.mae.toFixed(3)} / {s.metrics.rmse.toFixed(3)} kWh</strong><small>Baseline MAE {s.metrics.baselineMae.toFixed(3)} · improvement {s.metrics.improvementPercent.toFixed(1)}% · MAPE {s.metrics.mape.toFixed(1)}%</small></div>)}</div></section><section className="card"><h2>Forecast</h2><div className="table-wrap"><table><thead><tr><th>Step</th><th>Demand (kWh)</th><th>Generation (kWh)</th></tr></thead><tbody>{result.forecasts.map((row) => <tr key={row.step}><td>{row.step}</td><td>{row.demandKwh === undefined ? '—' : row.demandKwh.toFixed(3)}</td><td>{row.generationKwh === undefined ? '—' : row.generationKwh.toFixed(3)}</td></tr>)}</tbody></table></div></section></>}</main></>;
}
