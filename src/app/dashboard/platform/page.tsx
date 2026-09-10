'use client';

import { useEffect, useState } from 'react';

type Project = { id: string; name: string };
type ApiKey = { id: string; project_id: string; name: string; key_prefix: string; created_at: string; last_used_at?: string | null; revoked_at?: string | null };

export default function PlatformPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('Developer key');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const [projectsResponse, keysResponse] = await Promise.all([fetch('/api/projects'), fetch('/api/platform/keys')]);
    if (!projectsResponse.ok || !keysResponse.ok) throw new Error('Unable to load platform data');
    const projectData = await projectsResponse.json() as Project[];
    const keyData = await keysResponse.json() as { keys: ApiKey[] };
    setProjects(projectData);
    setKeys(keyData.keys);
    if (!projectId && projectData[0]) setProjectId(projectData[0].id);
  }

  useEffect(() => { load().catch((e) => setError(e instanceof Error ? e.message : 'Unable to load platform data')); }, []);

  async function createKey() {
    setError(''); setSecret(''); setBusy(true);
    try {
      const response = await fetch('/api/platform/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, name }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create API key');
      setSecret(data.secret);
      setName('Developer key');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create API key'); } finally { setBusy(false); }
  }

  async function revokeKey(id: string) {
    setError('');
    const response = await fetch(`/api/platform/keys?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) { const data = await response.json(); setError(data.error || 'Could not revoke key'); return; }
    await load();
  }

  return <main className="container"><nav className="nav"><strong>IntelligentEnergy</strong><a href="/dashboard">Back to dashboard</a></nav><header><h1>Developer Platform</h1><p>Generate project-scoped API keys and connect external software to IntelligentEnergy's simulation, forecasting, and optimization engines.</p></header>{error && <div className="error" role="alert">{error}</div>}{secret && <section className="card"><h2>New API secret</h2><p>Copy this value now. IntelligentEnergy stores only a SHA-256 hash, so the secret cannot be displayed again.</p><code style={{ display: 'block', overflowWrap: 'anywhere', padding: 12, background: '#111', borderRadius: 8 }}>{secret}</code></section>}<section className="card"><h2>Create API key</h2><div className="form-grid"><label>Project<select value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>Key name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label><button disabled={busy || !projectId || !name.trim()} onClick={createKey}>{busy ? 'Creating…' : 'Create API key'}</button></div></section><section className="card"><h2>Your API keys</h2>{keys.length === 0 ? <p className="muted">No API keys yet.</p> : <div className="table-wrap"><table><thead><tr><th>Name</th><th>Project</th><th>Prefix</th><th>Created</th><th>Last used</th><th>Status</th><th /></tr></thead><tbody>{keys.map((key) => <tr key={key.id}><td>{key.name}</td><td>{projects.find((p) => p.id === key.project_id)?.name ?? key.project_id}</td><td><code>{key.key_prefix}…</code></td><td>{new Date(key.created_at).toLocaleString()}</td><td>{key.last_used_at ? new Date(key.last_used_at).toLocaleString() : 'Never'}</td><td>{key.revoked_at ? 'Revoked' : 'Active'}</td><td>{!key.revoked_at && <button onClick={() => revokeKey(key.id)}>Revoke</button>}</td></tr>)}</tbody></table></div>}</section><section className="card"><h2>API endpoints</h2><ul><li><code>POST /api/v1/simulate</code> — deterministic energy simulation</li><li><code>POST /api/v1/forecast</code> — 1–48 step demand/generation forecasting</li><li><code>POST /api/v1/optimize</code> — battery scheduling optimization</li></ul><p className="muted">Send the secret as <code>Authorization: Bearer &lt;key&gt;</code>. Each key is limited to 1,000 requests per rolling 24-hour window.</p></section></main>;
}
