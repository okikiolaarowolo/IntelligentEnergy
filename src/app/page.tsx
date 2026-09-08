import Link from 'next/link';

export default function Home() {
  return <main className="container">
    <section className="card" style={{ marginTop: 80, textAlign: 'center' }}>
      <h1>IntelligentEnergy</h1>
      <p className="muted">Model energy systems. Understand performance. Build toward intelligent energy management.</p>
      <div style={{ display:'flex', gap:12, justifyContent:'center', marginTop:24 }}>
        <Link href="/login"><button>Sign in</button></Link>
        <Link href="/signup"><button className="secondary">Create account</button></Link>
      </div>
    </section>
  </main>;
}
