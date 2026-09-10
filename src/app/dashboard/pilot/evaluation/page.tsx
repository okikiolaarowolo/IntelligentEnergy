'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Project = { id: string; name: string };
type Dataset = { id: string; name: string; row_count: number };
type Evaluation = { id: string; modelVersion: string; baseline: { gridImportKwh: number; curtailedKwh: number; demandKwh: number; generationKwh: number }; optimized: { gridImportKwh: number; curtailedKwh: number; batteryChargeInputKwh: number; batteryDischargeDeliveredKwh: number }; comparison: { gridImportReductionKwh: number; gridImportReductionPercent: number; curtailmentReductionKwh: number; curtailmentReductionPercent: number; renewableUtilizationPercent: number; estimatedBaselineCost: number; estimatedOptimizedCost: number; estimatedCostDifference: number; estimatedCostSavingsPercent: number; batteryDischargeDeliveredKwh: number; batteryChargeInputKwh: number }; assumptions: { batteryCapacityKwh: number; initialSocKwh: number; chargeEfficiency: number; dischargeEfficiency: number; gridImportCostPerKwh: number; curtailmentCostPerKwh: number; batteryThroughputCostPerKwh: number; evaluationMode: string } };

export default function PilotEvaluationPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [projectId, setProjectId] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [battery, setBattery] = useState('10');
  const [soc, setSoc] = useState('0');
  const [charge, setCharge] = useState('0.9');
  const [discharge, setDischarge] = useState('0.9');
  const [gridCost, setGridCost] = useState('1');
  const [curtailmentCost, setCurtailmentCost] = useState('0.1');
  const [throughputCost, setThroughputCost] = useState('0.01');
  const [result, setResult] = useState<Evaluation | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function api(url: string, options?: RequestInit) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || 'Request failed');
    return data;
  }

  useEffect(() => { api('/api/projects').then((data) => { setProjects(data); if (data[0]) setProjectId(data[0].id); }).catch((e) => setError(e.message)); }, []);
  useEffect(() => { if (!projectId) return; api(`/api/pilot/datasets?projectId=${encodeURIComponent(projectId)}`).then((data) => { setDatasets(data); setDatasetId(data[0]?.id ?? ''); }).catch((e) => setError(e.message)); }, [projectId]);

  async function evaluate() {
    setBusy(true); setError(''); setResult(null);
    try {
      if (!projectId || !datasetId) throw new Error('Select a project and pilot dataset');
      const data = await api('/api/pilot/evaluations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, datasetId, batteryCapacityKwh: Number(battery), initialSocKwh: Number(soc), chargeEfficiency: Number(charge), dischargeEfficiency: Number(discharge), gridImportCostPerKwh: Number(gridCost), curtailmentCostPerKwh: Number(curtailmentCost), batteryThroughputCostPerKwh: Number(throughputCost) }) });
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Evaluation failed'); } finally { setBusy(false); }
  }

  const pct = (value: number) => `${value.toFixed(1)}%`;
  const kwh = (value: number) => `${value.toFixed(3)} kWh`;
  const money = (value: number) => value.toFixed(2);

  return <>
    <nav className="nav"><strong>IntelligentEnergy</strong><div className="actions"><button onClick={() => router.push('/dashboard')}>Dashboard</button><button onClick={() => router.push('/dashboard/pilot')}>Pilot Data</button><button onClick={() => router.push('/dashboard/prediction')}>Prediction Lab</button><button onClick={() => router.push('/dashboard/optimization')}>Optimization Lab</button></div></nav>
    <main className="container">
      <header><h1>Pilot Evaluation</h1><p>Compare the imported pilot baseline with a battery-optimized schedule under explicit assumptions. This evaluation is a historical-profile optimization, not a forecast backtest and not a claim of real-world financial savings.</p></header>
      {error && <div className="error" role="alert">{error}</div>}
      <section className="card form-card"><h2>Evaluation assumptions</h2><div className="form-grid"><label>Project<select value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Select project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Pilot dataset<select value={datasetId} onChange={(e) => setDatasetId(e.target.value)}><option value="">Select dataset</option>{datasets.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.row_count} rows)</option>)}</select></label><label>Battery capacity (kWh)<input type="number" min="0" step="0.1" value={battery} onChange={(e) => setBattery(e.target.value)} /></label><label>Initial SOC (kWh)<input type="number" min="0" step="0.1" value={soc} onChange={(e) => setSoc(e.target.value)} /></label><label>Charge efficiency<input type="number" min="0.01" max="1" step="0.01" value={charge} onChange={(e) => setCharge(e.target.value)} /></label><label>Discharge efficiency<input type="number" min="0.01" max="1" step="0.01" value={discharge} onChange={(e) => setDischarge(e.target.value)} /></label><label>Grid import cost / kWh<input type="number" min="0.0001" step="0.01" value={gridCost} onChange={(e) => setGridCost(e.target.value)} /></label><label>Curtailment cost / kWh<input type="number" min="0" step="0.01" value={curtailmentCost} onChange={(e) => setCurtailmentCost(e.target.value)} /></label><label>Battery throughput cost / kWh<input type="number" min="0" step="0.001" value={throughputCost} onChange={(e) => setThroughputCost(e.target.value)} /></label></div><button onClick={evaluate} disabled={busy || !projectId || !datasetId}>{busy ? 'Evaluating…' : 'Run pilot evaluation'}</button></section>
      {result && <>
        <section className="card form-card"><h2>Measured baseline vs optimized schedule</h2><div className="metrics"><div className="metric"><span>Grid import reduction</span><strong>{kwh(result.comparison.gridImportReductionKwh)}</strong><small>{pct(result.comparison.gridImportReductionPercent)}</small></div><div className="metric"><span>Curtailment reduction</span><strong>{kwh(result.comparison.curtailmentReductionKwh)}</strong><small>{pct(result.comparison.curtailmentReductionPercent)}</small></div><div className="metric"><span>Estimated cost difference</span><strong>{money(result.comparison.estimatedCostDifference)}</strong><small>{pct(result.comparison.estimatedCostSavingsPercent)}</small></div><div className="metric"><span>Renewable utilization</span><strong>{pct(result.comparison.renewableUtilizationPercent)}</strong></div><div className="metric"><span>Battery discharged</span><strong>{kwh(result.comparison.batteryDischargeDeliveredKwh)}</strong></div><div className="metric"><span>Battery charged</span><strong>{kwh(result.comparison.batteryChargeInputKwh)}</strong></div></div></section>
        <section className="card form-card"><h2>Before / after</h2><div className="grid grid-2"><div><h3>Baseline</h3><p>Grid import: <strong>{kwh(result.baseline.gridImportKwh)}</strong></p><p>Curtailed: <strong>{kwh(result.baseline.curtailedKwh)}</strong></p><p>Estimated cost: <strong>{money(result.comparison.estimatedBaselineCost)}</strong></p></div><div><h3>Optimized</h3><p>Grid import: <strong>{kwh(result.optimized.gridImportKwh)}</strong></p><p>Curtailed: <strong>{kwh(result.optimized.curtailedKwh)}</strong></p><p>Estimated cost: <strong>{money(result.comparison.estimatedOptimizedCost)}</strong></p></div></div></section>
        <section className="card form-card"><h2>Assumptions & interpretation</h2><p>Battery: {result.assumptions.batteryCapacityKwh} kWh; initial SOC: {result.assumptions.initialSocKwh} kWh; charge/discharge efficiency: {result.assumptions.chargeEfficiency}/{result.assumptions.dischargeEfficiency}.</p><p>Grid cost: {result.assumptions.gridImportCostPerKwh} per kWh; curtailment cost: {result.assumptions.curtailmentCostPerKwh} per kWh; throughput cost: {result.assumptions.batteryThroughputCostPerKwh} per kWh.</p><p><strong>Important:</strong> the optimizer is given the historical demand/generation profile itself. This is useful as a feasibility/value upper-bound study, but it is not evidence that the system would achieve the same savings in live operation. A later forecast backtest should evaluate predictions without using future actuals when making dispatch decisions.</p><p>Optimizer model: <code>{result.modelVersion}</code>.</p></section>
      </>}
    </main>
  </>;
}
