'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-Hant">
      <body
        style={{
          margin: 0,
          background: '#111827',
          color: '#f9fafb',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <main style={{ maxWidth: 640, margin: '12vh auto', padding: 24 }}>
          <h1>應用程式暫時無法顯示。</h1>
          <p>請重試或返回首頁。尚未保存的編輯可能遺失；已送出的任務請先確認狀態，避免重複提交。</p>
          <button type="button" onClick={reset}>
            重試畫面
          </button>{' '}
          <a href="/" style={{ color: '#93c5fd' }}>
            返回首頁
          </a>
        </main>
      </body>
    </html>
  );
}
