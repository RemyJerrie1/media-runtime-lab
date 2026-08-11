const endpoints = [
  { method: 'POST', path: '/v1/render-jobs', purpose: 'Create an idempotent render job', contract: 'CreateRenderJob → RenderJob' },
  { method: 'GET', path: '/v1/render-jobs/:id', purpose: 'Read the authoritative job state', contract: 'RenderJob | JOB_NOT_FOUND' },
  { method: 'SSE', path: '/v1/render-jobs/:id/events', purpose: 'Stream state transitions and progress', contract: 'render.progress<RenderJob>' },
];

export default function ApiReference() {
  return <main>
    <header className="nav"><a className="brand" href="/">MEDIA RUNTIME LAB</a><nav><a href="/">Back to system</a></nav></header>
    <section className="docs">
      <p className="eyebrow">STATIC API REFERENCE</p>
      <h1>Render Job API</h1>
      <p className="lede">One contract governs the NestJS API, Next.js client, Bruno collection, and regression suite.</p>
      <div className="endpoint-list">{endpoints.map((endpoint) => <article key={endpoint.path}>
        <code className={endpoint.method.toLowerCase()}>{endpoint.method}</code>
        <div><h2>{endpoint.path}</h2><p>{endpoint.purpose}</p><small>{endpoint.contract}</small></div>
      </article>)}</div>
      <section className="contract">
        <h2>State Contract</h2>
        <pre>{`accepted → composing → encoding → packaging → ready
          ↘ failed     ↘ failed     ↘ failed

Retry: same idempotency key returns the original job.
Recovery: re-fetch the authoritative resource after reconnect.`}</pre>
      </section>
    </section>
  </main>;
}
