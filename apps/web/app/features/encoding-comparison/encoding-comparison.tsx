'use client';

import { useRef, useState } from 'react';
import { encodingBenchmarkSchema } from '@media-lab/contracts';
import rawReport from '../../../public/benchmarks/report.json';
import styles from './encoding-comparison.module.css';

const report = encodingBenchmarkSchema.parse(rawReport);
export function EncodingComparison() {
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const [error, setError] = useState(false);
  async function playAll() {
    setError(false);
    const results = await Promise.allSettled(
      videos.current.map((video) => {
        if (!video) return Promise.resolve();
        video.currentTime = 0;
        return video.play();
      }),
    );
    if (results.some((result) => result.status === 'rejected')) setError(true);
  }
  return (
    <section className={styles.section} aria-labelledby="encoding-comparison-title">
      <p className={styles.eyebrow}>同素材 · 真實 FFmpeg 實測</p>
      <h2 id="encoding-comparison-title">編碼速度、檔案大小與畫面，一起比較</h2>
      <p>
        以下為已保存的本機測量，並非即時跑分。三組使用同一段 3 秒素材、640 × 360、30 fps、無音訊與 2
        個編碼執行緒；每組量測 3 次，顯示中位數。
      </p>
      <button type="button" onClick={() => void playAll()}>
        三組成品從頭播放
      </button>
      {error ? <p role="alert">瀏覽器未允許自動播放，請使用各影片的播放按鈕。</p> : null}
      <div className={styles.grid}>
        {report.results.map((row, index) => (
          <article key={row.id}>
            <h3>
              {row.preset} · CRF {row.crf}
            </h3>
            <video
              ref={(element) => {
                videos.current[index] = element;
              }}
              controls
              muted
              playsInline
              preload="metadata"
              src={row.videoUrl}
              poster={row.posterUrl}
              aria-label={`${row.preset} CRF ${row.crf} 實測成品`}
            />
            <dl>
              <dt>編碼耗時中位數</dt>
              <dd>{row.medianMs.toFixed(2)} ms</dd>
              <dt>成品大小</dt>
              <dd>{(row.sizeBytes / 1024).toFixed(1)} KiB</dd>
              <dt>三次耗時</dt>
              <dd>{row.elapsedMs.join(' / ')} ms</dd>
            </dl>
            <a href={row.videoUrl} download>
              下載這組實測成品
            </a>
          </article>
        ))}
      </div>
      <p>
        preset 影響編碼工作量；CRF
        改變壓縮取捨。請對照相同時間點觀察細節；檔案較小不代表畫質較好，本次沒有宣稱 VMAF
        或其他客觀畫質分數。
      </p>
      <details>
        <summary>測試環境與重現方式</summary>
        <dl>
          <dt>實測時間</dt>
          <dd>{report.measuredAt}</dd>
          <dt>CPU</dt>
          <dd>
            {report.environment.cpu}（{report.environment.logicalCpus} 邏輯核心）
          </dd>
          <dt>環境</dt>
          <dd>
            {report.environment.platform} / {report.environment.arch} / Node{' '}
            {report.environment.node}
          </dd>
          <dt>FFmpeg</dt>
          <dd>{report.environment.ffmpeg}</dd>
          <dt>來源 SHA-256</dt>
          <dd>{report.source.sha256}</dd>
        </dl>
        <p>
          先暖機一次，再以輪替順序逐組測量。耗時包含程序啟動與寫檔，不包含 probe
          與解碼驗證；這是單一環境的結果，不是通用效能排名。
        </p>
        <p>
          在專案執行 <code>pnpm benchmark</code> 重新測量；執行 <code>pnpm benchmark:verify</code>{' '}
          核對來源、成品雜湊、大小、中位數與實際解碼。
        </p>
        <a href="/benchmarks/report.json" download>
          下載完整測量資料
        </a>
      </details>
    </section>
  );
}
