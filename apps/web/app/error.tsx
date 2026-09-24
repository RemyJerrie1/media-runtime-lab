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
      <p className="lede">
        請重試畫面。尚未保存的編輯可能遺失；若曾送出任務，請先恢復原操作並確認結果，避免重複提交。
      </p>
      <Button onClick={reset}>重新載入畫面</Button>
      <p>
        <a href="/">返回首頁</a>
      </p>
    </main>
  );
}
