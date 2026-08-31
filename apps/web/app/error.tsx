'use client';

import { Button } from './design-system/button';

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="docs">
      <p className="eyebrow">可復原的介面錯誤</p>
      <h1>媒體畫面暫時中斷。</h1>
      <p className="lede">伺服器仍保有權威任務狀態；重新載入畫面不會重複建立任務。</p>
      <Button onClick={reset}>重新載入畫面</Button>
    </main>
  );
}
