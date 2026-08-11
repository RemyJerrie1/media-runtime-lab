import { RenderLab } from './features/render-lab/render-lab';
import { CompositionShowcase } from './features/composition-showcase/composition-showcase';
import { CostGovernance } from './features/cost-governance/cost-governance';
import { NAVIGATION } from './shared/constants/navigation';

export default function Page() {
  return <main>
    <header className="nav">
      <a className="brand" href="/">MEDIA RUNTIME LAB</a>
      <nav>{NAVIGATION.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
    </header>
    <section className="hero">
      <div>
        <p className="eyebrow">CHLOE · SENIOR FULL-STACK MEDIA ENGINEER</p>
        <h1>Governed media compute,<br/>from creation to cost attribution.</h1>
        <p className="lede">Deterministic Canvas and FFmpeg workflows absorb unstable AI output. Every render remains traceable, recoverable, and attributable.</p>
      </div>
      <div className="signal">
        <span>MEDIA LIFECYCLE</span><strong>Create → Compose → Deliver</strong>
        <span>SERVICE QUALITY</span><strong>Trace → Recover → Optimize</strong>
      </div>
    </section>
    <RenderLab/>
    <CompositionShowcase />
    <CostGovernance />
    <section id="architecture" className="architecture">
      <p className="eyebrow">SYSTEM BOUNDARIES</p>
      <h2>Product flow, engineering boundaries, and operational evidence.</h2>
      <div className="flow">
        <article><b>01 · Product Experience</b><h3>Next.js + TypeScript</h3><p>Render command, live progress, and delivery feedback.</p></article><i>→</i>
        <article><b>02 · API & Workflow</b><h3>NestJS Application</h3><p>Validated contracts, idempotency, and job lifecycle.</p></article><i>→</i>
        <article><b>03 · Media Processing</b><h3>Canvas + FFmpeg Adapter</h3><p>Subtitle, sprite, composition, and deterministic output.</p></article><i>→</i>
        <article><b>04 · Delivery & Operations</b><h3>Artifact + Usage Ledger</h3><p>Checksum, recovery, token usage, and cost attribution.</p></article>
      </div>
    </section>
  </main>;
}
