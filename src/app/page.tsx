import Link from 'next/link';

const capabilities = [
  {
    icon: '01',
    title: 'Energy Analytics',
    text: 'Turn historical energy data into clear performance insights and measurable system views.',
  },
  {
    icon: '02',
    title: 'Demand Forecasting',
    text: 'Model future demand and renewable generation so teams can plan around expected conditions.',
  },
  {
    icon: '03',
    title: 'Storage Optimization',
    text: 'Explore constrained battery schedules designed to improve how available energy is used.',
  },
  {
    icon: '04',
    title: 'Scenario Simulation',
    text: 'Model energy systems before making operational decisions and compare different assumptions.',
  },
  {
    icon: '05',
    title: 'Pilot Evaluation',
    text: 'Compare historical energy profiles and quantify scenario-level performance changes.',
  },
  {
    icon: '06',
    title: 'Explainable Decisions',
    text: 'Convert analytical results into transparent recommendations with confidence and limitations.',
  },
];

const audiences = [
  'Businesses and commercial facilities',
  'Schools and institutional facilities',
  'Renewable-energy operators',
  'Energy managers and analysts',
];

export default function Home() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <a href="#top" className="brand" aria-label="IntelligentEnergy home">
          <span className="brand-mark">IE</span>
          <span>Intelligent<span>Energy</span></span>
        </a>
        <div className="landing-nav-links">
          <a href="#platform">Platform</a>
          <a href="#solutions">Solutions</a>
          <a href="#how-it-works">How it works</a>
          <a href="#about">About</a>
        </div>
        <div className="landing-actions">
          <Link href="/login">Sign in</Link>
          <Link href="/signup" className="nav-cta">Get started</Link>
        </div>
      </nav>

      <section id="top" className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">ENERGY INTELLIGENCE PLATFORM</p>
          <h1>Understand your energy. <span>Make smarter decisions.</span></h1>
          <p className="hero-text">
            IntelligentEnergy turns energy data into forecasts, simulations, optimization insights,
            and explainable recommendations for modern energy systems.
          </p>
          <div className="hero-actions">
            <Link href="/signup" className="primary-cta">Start exploring</Link>
            <a href="#platform" className="secondary-cta">Explore the platform ↓</a>
          </div>
          <div className="hero-note">
            <span className="status-dot" />
            Advisory intelligence — designed for analysis and decision support
          </div>
        </div>

        <div className="hero-visual" aria-label="IntelligentEnergy energy intelligence pipeline">
          <div className="visual-glow" />
          <div className="system-card">
            <div className="system-header">
              <span>ENERGY INTELLIGENCE</span>
              <span className="live-pill">LIVE MODEL</span>
            </div>
            <div className="energy-flow">
              <div className="flow-node"><strong>DATA</strong><span>Historical</span></div>
              <div className="flow-line" />
              <div className="flow-node"><strong>PREDICT</strong><span>Forecast</span></div>
              <div className="flow-line" />
              <div className="flow-node"><strong>OPTIMIZE</strong><span>Storage</span></div>
              <div className="flow-line" />
              <div className="flow-node"><strong>DECIDE</strong><span>Insights</span></div>
            </div>
            <div className="visual-metrics">
              <div><span>Demand</span><strong>Forecast</strong></div>
              <div><span>Storage</span><strong>Optimized</strong></div>
              <div><span>Decision</span><strong>Explainable</strong></div>
            </div>
          </div>
        </div>
      </section>

      <section className="trust-strip">
        <span>BUILT AROUND A SIMPLE FLOW</span>
        <strong>Data → Prediction → Optimization → Evaluation → Decision</strong>
      </section>

      <section id="platform" className="landing-section">
        <div className="section-heading">
          <p className="eyebrow">THE PLATFORM</p>
          <h2>From raw energy data to useful intelligence.</h2>
          <p>
            One platform for understanding system performance, testing scenarios, forecasting
            conditions, optimizing storage, and turning results into transparent recommendations.
          </p>
        </div>
        <div className="capability-grid">
          {capabilities.map((item) => (
            <article className="capability-card" key={item.title}>
              <div className="capability-icon">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="process-section">
        <div className="section-heading centered">
          <p className="eyebrow">HOW IT WORKS</p>
          <h2>A connected energy intelligence workflow.</h2>
        </div>
        <div className="process-grid">
          <div><span>01</span><h3>Understand</h3><p>Import and inspect historical demand and generation data.</p></div>
          <div><span>02</span><h3>Predict</h3><p>Generate forecasts from the available energy profile.</p></div>
          <div><span>03</span><h3>Optimize</h3><p>Calculate constrained storage schedules and system outcomes.</p></div>
          <div><span>04</span><h3>Evaluate</h3><p>Compare scenarios and surface measurable differences.</p></div>
          <div><span>05</span><h3>Decide</h3><p>Produce explainable recommendations with visible limitations.</p></div>
        </div>
      </section>

      <section id="solutions" className="landing-section solutions-section">
        <div className="solutions-copy">
          <p className="eyebrow">DESIGNED FOR REAL ENERGY QUESTIONS</p>
          <h2>Start with the problem. Let the data guide the decision.</h2>
          <p>
            IntelligentEnergy is being developed for organizations that need a clearer picture of
            where energy is going, what may happen next, and which decisions are worth testing.
          </p>
          <ul>
            {audiences.map((audience) => <li key={audience}>{audience}</li>)}
          </ul>
        </div>
        <div className="boundary-card">
          <span className="boundary-label">OUR APPROACH</span>
          <h3>Transparent by design.</h3>
          <p>
            Recommendations expose their confidence, assumptions, and limitations. The current
            platform is decision support; it does not directly control batteries, inverters,
            appliances, or the electrical grid.
          </p>
        </div>
      </section>

      <section id="about" className="vision-section">
        <p className="eyebrow">OUR VISION</p>
        <h2>Building toward intelligent energy management.</h2>
        <p>
          We are building IntelligentEnergy step by step — from software that understands energy
          systems today toward deeper monitoring, optimization, and eventually real-world energy
          infrastructure.
        </p>
      </section>

      <section className="final-cta">
        <div>
          <p className="eyebrow">READY TO EXPLORE?</p>
          <h2>See what your energy data can tell you.</h2>
          <p>Create an account and explore the IntelligentEnergy platform.</p>
        </div>
        <Link href="/signup" className="primary-cta">Create your account →</Link>
      </section>

      <footer className="landing-footer">
        <div className="brand"><span className="brand-mark">IE</span><span>Intelligent<span>Energy</span></span></div>
        <p>Energy intelligence for better decisions.</p>
        <span>© {new Date().getFullYear()} IntelligentEnergy</span>
      </footer>
    </main>
  );
}
