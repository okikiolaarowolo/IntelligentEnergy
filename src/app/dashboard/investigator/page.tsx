'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { investigateEnergy, type InvestigationReport } from '@/lib/energy-investigation-agent';
import { optimizeEnergy } from '@/lib/optimizer';

function parseProfile(value: string, label: string): number[] {
  const parts = value.split(',').map((part) => part.trim());
  if (parts.some((part) => part.length === 0)) throw new Error(`${label} contains an empty time step.`);
  const values = parts.map(Number);
  if (!values.length || values.some((number) => !Number.isFinite(number) || number < 0)) {
    throw new Error(`${label} must be comma-separated, finite, non-negative kWh values.`);
  }
  if (values.length > 48) throw new Error('Use no more than 48 time steps.');
  return values;
}

function formatKwh(value: number) {
  return `${value.toFixed(2)} kWh`;
}

export default function InvestigatorPage() {
  const router = useRouter();
  const [generation, setGeneration] = useState('2,1,0,5,7,3');
  const [demand, setDemand] = useState('3,4,4,4,5,4');
  const [capacity, setCapacity] = useState('5');
  const [initialSoc, setInitialSoc] = useState('2');
  const [chargeEfficiency, setChargeEfficiency] = useState('0.9');
  const [dischargeEfficiency, setDischargeEfficiency] = useState('0.9');
  const [quality, setQuality] = useState('85');
  const [warnings, setWarnings] = useState('');
  const [report, setReport] = useState<InvestigationReport | null>(null);
  const [agentReport, setAgentReport] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function runAgentInvestigation() {
    setError('');
    setAgentReport(null);
    setBusy(true);
    try {
      const generationForecastKwh = parseProfile(generation, 'Generation profile');
      const demandForecastKwh = parseProfile(demand, 'Demand profile');
      if (generationForecastKwh.length !== demandForecastKwh.length) throw new Error('Generation and demand profiles must have the same number of steps.');
      const batteryCapacityKwh = Number(capacity);
      const initialSocKwh = Number(initialSoc);
      const charge = Number(chargeEfficiency);
      const discharge = Number(dischargeEfficiency);
      const qualityScore = quality.trim() === '' ? undefined : Number(quality);
      if (!Number.isFinite(batteryCapacityKwh) || batteryCapacityKwh < 0) throw new Error('Battery capacity must be non-negative.');
      if (!Number.isFinite(initialSocKwh) || initialSocKwh < 0 || initialSocKwh > batteryCapacityKwh) throw new Error('Initial charge must be between zero and battery capacity.');
      if (!Number.isFinite(charge) || charge <= 0 || charge > 1 || !Number.isFinite(discharge) || discharge <= 0 || discharge > 1) throw new Error('Efficiencies must be greater than 0 and at most 1.');
      if (qualityScore !== undefined && (!Number.isFinite(qualityScore) || qualityScore < 0 || qualityScore > 100)) throw new Error('Data-quality score must be between 0 and 100.');
      const response = await fetch('/api/energy-investigator/agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationForecastKwh, demandForecastKwh, batteryCapacityKwh, initialSocKwh, chargeEfficiency: charge, dischargeEfficiency: discharge, qualityScore, warnings: warnings.split('\\n').map((item) => item.trim()).filter(Boolean).slice(0, 3) }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(result && typeof result === 'object' && 'error' in result && typeof result.error === 'string' ? result.error : 'AI investigation failed.');
      if (!result || typeof result !== 'object') throw new Error('The agent returned an invalid response.');
      setAgentReport(result as Record<string, unknown>);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AI investigation could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  function runInvestigation(event: FormEvent) {
    event.preventDefault();
    setError('');
    setReport(null);
    setBusy(true);
    try {
      const generationProfile = parseProfile(generation, 'Generation profile');
      const demandProfile = parseProfile(demand, 'Demand profile');
      if (generationProfile.length !== demandProfile.length) {
        throw new Error('Generation and demand profiles must have the same number of steps.');
      }
      const batteryCapacityKwh = Number(capacity);
      const initialSocKwh = Number(initialSoc);
      const charge = Number(chargeEfficiency);
      const discharge = Number(dischargeEfficiency);
      const qualityScore = quality.trim() === '' ? undefined : Number(quality);
      if (!Number.isFinite(batteryCapacityKwh) || batteryCapacityKwh < 0) throw new Error('Battery capacity must be a non-negative number.');
      if (!Number.isFinite(initialSocKwh) || initialSocKwh < 0 || initialSocKwh > batteryCapacityKwh) throw new Error('Initial state of charge must be between zero and battery capacity.');
      if (!Number.isFinite(charge) || charge <= 0 || charge > 1 || !Number.isFinite(discharge) || discharge <= 0 || discharge > 1) throw new Error('Charge and discharge efficiency must be greater than 0 and at most 1.');
      if (qualityScore !== undefined && (!Number.isFinite(qualityScore) || qualityScore < 0 || qualityScore > 100)) throw new Error('Data-quality score must be between 0 and 100, or left blank.');
      const optimization = optimizeEnergy({
        generationForecastKwh: generationProfile,
        demandForecastKwh: demandProfile,
        batteryCapacityKwh,
        initialSocKwh,
        chargeEfficiency: charge,
        dischargeEfficiency: discharge,
      });
      const warningList = warnings.split('\n').map((warning) => warning.trim()).filter(Boolean).slice(0, 3);
      setReport(investigateEnergy({
        forecastDemandKwh: demandProfile,
        forecastGenerationKwh: generationProfile,
        optimization,
        dataQuality: { qualityScore, warnings: warningList },
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Investigation could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <nav className="nav">
        <strong>IntelligentEnergy</strong>
        <div className="actions">
          <button onClick={() => router.push('/dashboard')}>Back to dashboard</button>
          <button onClick={() => router.push('/dashboard/optimization')}>Optimization Lab</button>
        </div>
      </nav>
      <main className="container">
        <header>
          <h1>Energy Investigation Agent</h1>
          <p>Run an evidence-first investigation on an energy scenario. The prototype combines the existing storage optimizer with deterministic, explainable rules.</p>
        </header>

        <section className="card">
          <h2>Scenario inputs</h2>
          <p className="muted">Enter comma-separated kWh values for matching time steps. The prefilled values are illustrative, not measured site data.</p>
          {error && <div className="error" role="alert">{error}</div>}
          <form onSubmit={runInvestigation} className="form-grid">
            <label>Forecast generation (kWh per step)
              <textarea value={generation} onChange={(event) => setGeneration(event.target.value)} required rows={3} />
            </label>
            <label>Forecast demand (kWh per step)
              <textarea value={demand} onChange={(event) => setDemand(event.target.value)} required rows={3} />
            </label>
            <label>Battery capacity (kWh)
              <input type="number" min="0" step="any" value={capacity} onChange={(event) => setCapacity(event.target.value)} required />
            </label>
            <label>Initial battery charge (kWh)
              <input type="number" min="0" step="any" value={initialSoc} onChange={(event) => setInitialSoc(event.target.value)} required />
            </label>
            <label>Charge efficiency (0–1)
              <input type="number" min="0.000001" max="1" step="any" value={chargeEfficiency} onChange={(event) => setChargeEfficiency(event.target.value)} required />
            </label>
            <label>Discharge efficiency (0–1)
              <input type="number" min="0.000001" max="1" step="any" value={dischargeEfficiency} onChange={(event) => setDischargeEfficiency(event.target.value)} required />
            </label>
            <label>Data-quality score (0–100; optional)
              <input type="number" min="0" max="100" step="any" value={quality} onChange={(event) => setQuality(event.target.value)} />
            </label>
            <label>Data warnings (optional; one per line)
              <textarea value={warnings} onChange={(event) => setWarnings(event.target.value)} rows={3} placeholder="Example: Some readings may be missing" />
            </label>
            <div className="actions">
              <button type="submit" disabled={busy}>{busy ? 'Working…' : 'Run rule-based investigation'}</button>
              <button type="button" onClick={runAgentInvestigation} disabled={busy}>{busy ? 'Agent working…' : 'Run AI agent investigation'}</button>
            </div>
          </form>
        </section>

        {agentReport && <section className="card" aria-live="polite">
          <h2>AI agent investigation</h2>
          <p className="muted">LLM tool-calling mode · Advisory only · Review cited evidence before acting</p>
          <p>{typeof agentReport.summary === 'string' ? agentReport.summary : 'Investigation completed.'}</p>
          {Boolean(agentReport.verifier) && typeof agentReport.verifier === 'object' && <p><strong>Claim verification:</strong> {JSON.stringify(agentReport.verifier)}</p>}
          {Array.isArray(agentReport.findings) && agentReport.findings.map((item, index) => item && typeof item === 'object' ? <article className="card" key={index}>
            <p><strong>{'title' in item && typeof item.title === 'string' ? item.title : 'Finding'}</strong></p>
            <p>{'explanation' in item && typeof item.explanation === 'string' ? item.explanation : ''}</p>
            {'severity' in item && <p><strong>Severity:</strong> {String(item.severity)}</p>}
            {'confidence' in item && <p><strong>Confidence:</strong> {String(item.confidence)}</p>}
            {'toolResultIds' in item && <p className="muted"><strong>Evidence result IDs:</strong> {Array.isArray(item.toolResultIds) ? item.toolResultIds.join(', ') : 'None'}</p>}
            {'nextStep' in item && <p><strong>Next step:</strong> {String(item.nextStep)}</p>}
          </article> : null)}
          {Array.isArray(agentReport.blockedClaims) && agentReport.blockedClaims.length > 0 && <><h3>Claims blocked by verifier</h3><ul>{agentReport.blockedClaims.map((item, index) => <li key={index}>{JSON.stringify(item)}</li>)}</ul></>}
          {Array.isArray(agentReport.missingData) && agentReport.missingData.length > 0 && <><h3>Missing data</h3><ul>{agentReport.missingData.map((item, index) => <li key={index}>{String(item)}</li>)}</ul></>}
          {Array.isArray(agentReport.limitations) && agentReport.limitations.length > 0 && <><h3>Limitations</h3><ul>{agentReport.limitations.map((item, index) => <li key={index}>{String(item)}</li>)}</ul></>}
          {Array.isArray(agentReport.toolResults) && <details><summary>Tool result ledger</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(agentReport.toolResults, null, 2)}</pre></details>}
        </section>}

        {report && <>
          <section className="card" aria-live="polite">
            <h2>Investigation report</h2>
            <p><strong>Status:</strong> {report.status.replaceAll('-', ' ')}</p>
            <p>{report.headline}</p>
            <p className="muted">Agent version: {report.agentVersion} · Rule-based prototype · Advisory only</p>
            <div className="metrics">
              <div className="metric"><span>Forecast demand</span><strong>{formatKwh(report.keyMetrics.forecastDemandKwh)}</strong></div>
              <div className="metric"><span>Forecast generation</span><strong>{formatKwh(report.keyMetrics.forecastGenerationKwh)}</strong></div>
              <div className="metric"><span>Pre-storage shortfall</span><strong>{formatKwh(report.keyMetrics.forecastShortfallKwh)}</strong></div>
              <div className="metric"><span>Pre-storage surplus</span><strong>{formatKwh(report.keyMetrics.forecastSurplusKwh)}</strong></div>
              <div className="metric"><span>Optimized grid import</span><strong>{formatKwh(report.keyMetrics.optimizedGridImportKwh)}</strong></div>
              <div className="metric"><span>Optimized curtailment</span><strong>{formatKwh(report.keyMetrics.optimizedCurtailmentKwh)}</strong></div>
              <div className="metric"><span>Peak demand</span><strong>{formatKwh(report.keyMetrics.peakDemandKwh)}</strong><small>Step {report.keyMetrics.peakDemandStep}</small></div>
            </div>
          </section>

          <section className="card">
            <h2>Findings and evidence</h2>
            {report.findings.map((finding) => (
              <article className="card" key={finding.id}>
                <p><strong>{finding.severity.toUpperCase()} · {finding.title}</strong></p>
                <p>{finding.explanation}</p>
                <p><strong>Evidence</strong></p>
                <ul>{finding.evidence.map((item, index) => <li key={index}>{item}</li>)}</ul>
                <p><strong>Recommended next step:</strong> {finding.recommendedNextStep}</p>
                <p className="muted">Confidence: {finding.confidence}</p>
              </article>
            ))}
          </section>

          <section className="card">
            <h2>Assumptions</h2>
            <ul>{report.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
            <h2>Safety boundary and limitations</h2>
            <ul>{report.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </>}
      </main>
    </>
  );
}
