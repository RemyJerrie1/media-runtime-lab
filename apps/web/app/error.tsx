'use client';

import { Button } from './design-system/button';

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="docs">
    <p className="eyebrow">RECOVERABLE UI BOUNDARY</p>
    <h1>Media view interrupted.</h1>
    <p className="lede">The render state remains authoritative on the server. Retry the view without duplicating the job.</p>
    <Button onClick={reset}>RETRY VIEW</Button>
  </main>;
}
