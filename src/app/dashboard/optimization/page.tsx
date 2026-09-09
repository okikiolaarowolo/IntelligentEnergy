'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Project = { id: string; name: string };
type ForecastRun = { id: string; dataset_id: string; model_version: string; horizon_steps: number; created_at: string; forecast_datasets?: { project_id: string; name: string } };
type OptimizationStep = { step: number; generationKwh: number; demandKwh: number; directGenerationToLoadKwh: number; batteryChargeInputKwh: number; batteryDischargeDeliveredKwh: number; gridImportKwh: number; curtailedKwh: number; socKwh: number; stepCost: number };
type OptimizationResult = { modelVersion: string; objectiveCost: number; resolutionKwh: number; steps: OptimizationStep[]; totals: { generationKwh: number; demandKwh: number; gridImportKwh: number; curtailedKwh: number; batteryChargeInputKwh: number; batteryDischargeDeliveredKwh: number; finalSocKwh: number } };

export default function OptimizationPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [forecastRuns, setForecastRuns] = useState<ForecastRun[]>([]);
  const [projectId, setProjectId] = useState('');
  const [forecastRunId, setForecastRunId] = useState('');
  const [capacity, setCapacity] = useState('10');
  const [initialSoc, setInitialSoc] = useState('5');
  const [chargeEfficiency, setChargeEfficiency] = useState('0.9');
  const [dischargeEfficiency, setDischargeEfficiency] = useState('0.9');
  const [gridCost, setGridCost] = useState('1');
  const [curtailmentCost, setCurtailmentCost] = useState('0.1');
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/projects').then(async (r) => { if (!r.ok) throw new Error('Unable to load projects'); return r.json(); }).then((data: Project[]) => { setProjects(data); if (data[0]) setProjectId(data[0].id); }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/forecast-runs?projectId=${encodeURIComponent(projectId)}`).then(async (r) => { if (!r.ok) throw new Error('Unable to load forecast runs'); return r.json(); }).then((data: ForecastRun[]) => { setForecastRuns(data); setForecastRunId(data[0]?.id ?? ''); }).catch((e) => setError(e.message));
  }, [projectId]);

  async function optimize(e: FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (!projectId || !forecastRunId) throw new Error('Create a forecast run first');
      const response = await fetch('/api/optimization', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, forecastRunId, batteryCapacityKwh: Number(capacity), initialSocKwh: Number(initialSoc), chargeEfficiency: Number(chargeEfficiency), dischargeEfficiency: Number(dischargeEfficiency), gridImportCostPerKwh: Number(gridCost), curtailmentCostPerKwh: Number(curtailmentCost) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Optimization failed');
      setResult(data.result);
    } catch (e) { setError(e instanceof Error ? e.message : 'Optimization failed'); } finally { setBusy(false); }
  }

  return <><nav className="nav"><strong>IntelligentEnergy</strong><button onClick={() => router.push('/dashboard')}>Back to dashboard</button></nav><main className="container"><header><h1>Optimization Lab</h1><p>Phase 4 converts a Phase 3 forecast into a deterministic battery dispatch schedule. It minimizes grid imports, curtailment, and battery throughput while respecting storage constraints.</p></header>{error && <div className="error" role="alert">{error}</div>}<section className="card"><h2>Optimization inputs</h2><form onSubmit={optimize} className="form-grid"><label>Project<select value={projectId} onChange={(e) => setProjectId(e.target.value)} required><option value="">Select project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Phase 3 forecast<select value={forecastRunId} onChange={(e) => setForecastRunId(e.target.value)} required><option value="">Select forecast</option>{forecastRuns.map((run) => <option key={run.id} value={run.id}>{run.forecast_datasets?.name ?? 'Forecast'} · {run.horizon_steps} steps · {run.model_version}</option>)}</select></label><label>Battery capacity (kWh)<input type="number" min="0" step="0.1" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></label><label>Initial state of charge (kWh)<input type="number" min="0" step="0.1" value={initialSoc} onChange={(e) => setInitialSoc(e.target.value)} /></label><label>Charge efficiency<input type="number" min="0.01" max="1" step="0.01" value={chargeEfficiency} onChange={(e) => setChargeEfficiency(e.target.value)} /></label><label>Discharge efficiency<input type="number" min="0.01" max="1" step="0.01" value={dischargeEfficiency} onChange={(e) => setDischargeEfficiency(e.target.value)} /></label><label>Grid import cost / kWh<input type="number" min="0.0001" step="0.01" value={gridCost} onChange={(e) => setGridCost(e.target.value)} /></label><label>Curtailment cost / kWh<input type="number" min="0" step="0.01" value={curtailmentCost} onChange={(e) => setCurtailmentCost(e.target.value)} /></label><button disabled={busy || !forecastRunId}>{busy ? 'Optimizing…' : 'Optimize schedule'}</button></form></section>{result && <><section className="card"><h2>Optimization result</h2><p><strong>{result.modelVersion}</strong> · {result.steps.length} steps · resolution {result.resolutionKwh.toFixed(3)} kWh</p><div className="metrics"><div className="metric"><span>Grid import</span><strong>{result.totals.gridImportKwh.toFixed(3)} kWh</strong></div><div className="metric"><span>Curtailed energy</span><strong>{result.totals.curtailedKwh.toFixed(3)} kWh</strong></div><div className="metric"><span>Battery discharge</span><strong>{result.totals.batteryDischargeDeliveredKwh.toFixed(3)} kWh</strong></div><div className="metric"><span>Final SOC</span><strong>{result.totals.finalSocKwh.toFixed(3)} kWh</strong></div></div><p className="muted">Objective cost: {result.objectiveCost.toFixed(3)}</p></section><section className="card"><h2>Dispatch schedule</h2><div className="table-wrap"><table><thead><tr><th>Step</th><th>Demand</th><th>Generation</th><th>Charge</th><th>Discharge</th><th>Grid import</th><th>Curtailed</th><th>SOC</th></tr></thead><tbody>{result.steps.map((step) => <tr key={step.step}><td>{step.step}</td><td>{step.demandKwh.toFixed(3)}</td><td>{step.generationKwh.toFixed(3)}</td><td>{step.batteryChargeInputKwh.toFixed(3)}</td><td>{step.batteryDischargeDeliveredKwh.toFixed(3)}</td><td>{step.gridImportKwh.toFixed(3)}</td><td>{step.curtailedKwh.toFixed(3)}</td><td>{step.socKwh.toFixed(3)}</td></tr>)}</tbody></table></div></section></>}</main></>;
}
