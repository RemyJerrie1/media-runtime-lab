import { RenderLab } from './features/render-lab/render-lab';

export default function Page() {
  return <main>
    <header className="nav">
      <a className="brand" href="/">MEDIA RUNTIME LAB</a>
      <nav><a href="#architecture">Architecture</a><a href="/api-reference">API Reference</a></nav>
    </header>
    <section className="hero">
      <div>
        <p className="eyebrow">CHLOE · SENIOR FULL-STACK MEDIA ENGINEER</p>
        <h1>Governed media compute,<br/>from creation to cost attribution.</h1>
        <p className="lede">Deterministic Canvas and FFmpeg workflows absorb unstable AI output. Every render remains traceable, recoverable, and attributable.</p>
      </div>
      <div className="signal">
        <span>CONTROL PLANE</span><strong>Contract → Job → Artifact</strong>
        <span>DATA PLANE</span><strong>Compose → Encode → Deliver</strong>
      </div>
    </section>
    <RenderLab/>
    <section id="architecture" className="architecture">
      <p className="eyebrow">SYSTEM BOUNDARIES</p>
      <h2>Small surface. Complete engineering semantics.</h2>
      <div className="flow">
        <article><b>01 · Experience</b><h3>Next.js + TypeScript</h3><p>Command, live status, and cost feedback.</p></article><i>→</i>
        <article><b>02 · Control</b><h3>NestJS Application</h3><p>Contract, idempotency, state machine.</p></article><i>→</i>
        <article><b>03 · Execution</b><h3>Media Worker Port</h3><p>Deterministic Canvas and FFmpeg output.</p></article><i>→</i>
        <article><b>04 · Evidence</b><h3>Artifact + Ledger</h3><p>Checksum, usage, token, and cost.</p></article>
      </div>
    </section>
  </main>;
}
