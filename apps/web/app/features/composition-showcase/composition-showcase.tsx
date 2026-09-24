'use client';

import {
  WATERMARK_PRESENTATION,
  type MediaAsset,
  type MediaProcessing,
} from '@media-lab/contracts';
import { useEffect, useState } from 'react';
import { artifactUrl, getDemoMedia, mediaFailureMessage } from '../../shared/api/render-jobs';
import { useRenderJob } from '../../shared/hooks/use-render-job';
import { PendingRenderOperation } from '../../shared/ui/pending-render-operation';
import { SectionHeading } from '../../shared/ui/section-heading';
import { RecoverableVideo } from '../../shared/ui/recoverable-video';
import styles from './composition-showcase.module.css';

function formatPts(seconds: number) {
  const wholeSeconds = Math.floor(seconds);
  const hours = String(Math.floor(wholeSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((wholeSeconds % 3600) / 60)).padStart(2, '0');
  const remaining = String(wholeSeconds % 60).padStart(2, '0');
  const micros = String(Math.floor((seconds % 1) * 1_000_000)).padStart(6, '0');
  return `${hours}:${minutes}:${remaining}.${micros}`;
}

export function CompositionShowcase() {
  const {
    job,
    busy,
    error,
    run,
    pending,
    retry,
    discardPending,
    paused,
    proof,
    pauseProgress,
    resumeProgress,
    replay,
    canReplay,
  } = useRenderJob('composition');
  const [loseResponse, setLoseResponse] = useState(false);
  const [source, setSource] = useState<MediaAsset | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sourceAttempt, setSourceAttempt] = useState(0);
  const [watermarkMode, setWatermarkMode] = useState<MediaProcessing['watermarkMode']>('visible');
  const [previewSeconds, setPreviewSeconds] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setSourceError(null);
    setSource(null);
    getDemoMedia(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setSource(value);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setSourceError(mediaFailureMessage(cause));
      });
    return () => controller.abort();
  }, [sourceAttempt]);

  return (
    <section id="composition" className={styles.section}>
      <SectionHeading
        eyebrow="媒體合成"
        title="同一支素材，從即時預覽到 FFmpeg 成品"
        description="先在前端確認浮水印，再由後端產生可播放、可下載並可驗證的影片。"
      />
      <div className={styles.grid}>
        <div className={styles.copy} data-tour="composition-content">
          <h3>一、選擇浮水印</h3>
          <p>預覽會立即更新；這一步不需要等待轉檔。</p>
          <label className={styles.control} data-tour="composition-options">
            浮水印模式
            <select
              value={watermarkMode}
              onChange={(event) =>
                setWatermarkMode(event.target.value as MediaProcessing['watermarkMode'])
              }
            >
              <option value="none">不加浮水印</option>
              <option value="visible">固定浮水印</option>
              <option value="dynamic">動態時間浮水印</option>
            </select>
          </label>
          <h3>二、產生後端成品</h3>
          <button
            type="button"
            data-tour="composition-submit"
            disabled={!source || busy || pending}
            onClick={() =>
              source &&
              run(
                {
                  sourceAssetId: source.id,
                  template: 'landscape',
                  trimStartSeconds: 0,
                  durationSeconds: 5,
                  encoding: {
                    codec: 'libx264',
                    preset: 'fast',
                    rateControl: 'crf',
                    crf: 23,
                    bitrateKbps: 4000,
                    gop: 60,
                    fps: 30,
                  },
                  processing: {
                    frameRateMode: 'cfr',
                    audioSampleRate: 48000,
                    audioSync: 'async-resample',
                    subtitleMode: 'none',
                    watermarkMode,
                    adInsertion: 'none',
                    fastStart: true,
                    deliveryFormat: 'mp4',
                    abrLadder: 'none',
                    qualityMetric: 'none',
                  },
                },
                { loseResponse },
              )
            }
          >
            {busy ? '正在建立任務…' : '產生 FFmpeg 成品'}
          </button>
          {pending ? (
            <PendingRenderOperation busy={busy} retry={retry} discard={discardPending} />
          ) : null}
          {error ? <p role="alert">{error}</p> : null}
          {job ? (
            <p aria-live="polite">
              處理進度：{job.progress}% · {job.status}
            </p>
          ) : null}
        </div>
        <div
          className={`${styles.stage} ${sourceError ? styles.failedStage : ''}`}
          data-tour="composition-preview"
        >
          {source ? (
            <video
              className={styles.canvas}
              autoPlay
              muted
              loop
              playsInline
              src={artifactUrl(source.url)}
              onTimeUpdate={(event) => setPreviewSeconds(event.currentTarget.currentTime)}
            />
          ) : sourceError ? (
            <div className={styles.sourceError} role="alert" aria-label="示範素材錯誤">
              <p>{sourceError}</p>
              <button type="button" onClick={() => setSourceAttempt((value) => value + 1)}>
                重試示範素材
              </button>
            </div>
          ) : (
            <p role="status" className={styles.loading}>
              正在準備電影感示範素材…
            </p>
          )}
          {source && watermarkMode !== 'none' ? (
            <div
              className={`${styles.watermarkPreview} ${watermarkMode === 'dynamic' ? styles.dynamicWatermark : styles.fixedWatermark}`}
              role="status"
              aria-live="polite"
            >
              {watermarkMode === 'dynamic'
                ? `${formatPts(previewSeconds)} · ${WATERMARK_PRESENTATION.dynamicSuffix}`
                : WATERMARK_PRESENTATION.fixedText}
            </div>
          ) : null}
        </div>
      </div>
      <section className={styles.recovery} aria-label="故障恢復實驗">
        <h3>故障恢復實驗</h3>
        <p>
          這裡操作真實後端任務。中斷只停止本頁進度連線，後端仍繼續轉檔；恢復時重新讀取後端狀態。
        </p>
        <label>
          <input
            type="checkbox"
            checked={loseResponse}
            disabled={busy || pending}
            onChange={(event) => setLoseResponse(event.target.checked)}
          />{' '}
          故障注入：下次送出後刻意丟棄成功回應
        </label>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={pauseProgress}
            disabled={
              !job || busy || pending || paused || job.status === 'ready' || job.status === 'failed'
            }
          >
            中斷進度連線
          </button>
          <button type="button" onClick={() => void resumeProgress()} disabled={!paused || busy}>
            恢復進度連線
          </button>
          <button
            type="button"
            onClick={() => void replay()}
            disabled={!canReplay || busy || pending}
          >
            重送原操作（驗證去重）
          </button>
        </div>
        <div role="status">
          {paused ? '已手動中斷：畫面暫停更新，後端任務不受影響。' : '尚未中斷，或已恢復觀察。'}
        </div>
        <dl>
          <dt>目前 job ID</dt>
          <dd data-testid="current-job-id">{job?.id ?? '尚未取得'}</dd>
          <dt>事件 sequence</dt>
          <dd>{job?.sequence ?? '—'}</dd>
        </dl>
        {proof ? (
          <div data-testid="recovery-proof">
            <p>{proof.action === 'disconnect' ? '連線恢復證據' : '重送去重證據'}</p>
            <dl>
              <dt>操作前 job ID</dt>
              <dd>{proof.before.id}</dd>
              <dt>操作前 sequence</dt>
              <dd>{proof.before.sequence}</dd>
              <dt>恢復／重送後 job ID</dt>
              <dd>{proof.after?.id ?? '等待操作'}</dd>
              <dt>恢復／重送後 sequence</dt>
              <dd>{proof.after?.sequence ?? '—'}</dd>
            </dl>
            {proof.after ? (
              <strong>
                {proof.before.id === proof.after.id
                  ? proof.action === 'disconnect'
                    ? '已確認：恢復同一筆任務'
                    : '已確認：重送回傳相同 job ID，未建立另一筆任務'
                  : '結果不一致：job ID 已改變'}
              </strong>
            ) : null}
          </div>
        ) : null}
      </section>
      {job?.status === 'ready' && job.artifactUrl ? (
        <div className={styles.artifact} data-tour="composition-result">
          <div>
            <strong>FFmpeg 實際成品</strong>
            <span>已完成、可播放、可下載</span>
          </div>
          <RecoverableVideo
            aria-label="合成輸出影片"
            controls
            autoPlay
            muted
            loop
            playsInline
            src={artifactUrl(job.artifactUrl)}
          />
        </div>
      ) : null}
    </section>
  );
}
