'use client';

import type { MediaAsset, MediaProcessing } from '@media-lab/contracts';
import { useEffect, useState } from 'react';
import { artifactUrl, getDemoMedia } from '../../shared/api/render-jobs';
import { useRenderJob } from '../../shared/hooks/use-render-job';
import { SectionHeading } from '../../shared/ui/section-heading';
import styles from './composition-showcase.module.css';

export function CompositionShowcase() {
  const { job, busy, error, run } = useRenderJob();
  const [source, setSource] = useState<MediaAsset | null>(null);
  const [watermarkMode, setWatermarkMode] = useState<MediaProcessing['watermarkMode']>('visible');
  useEffect(() => {
    getDemoMedia()
      .then(setSource)
      .catch(() => setSource(null));
  }, []);

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
            disabled={!source || busy}
            onClick={() =>
              source &&
              run({
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
                },
              })
            }
          >
            {busy ? '正在建立任務…' : '產生 FFmpeg 成品'}
          </button>
          {error ? <p role="alert">{error}</p> : null}
          {job ? (
            <p aria-live="polite">
              處理進度：{job.progress}% · {job.status}
            </p>
          ) : null}
        </div>
        <div className={styles.stage} data-tour="composition-preview">
          {source ? (
            <video
              className={styles.canvas}
              autoPlay
              muted
              loop
              playsInline
              src={artifactUrl(source.url)}
            />
          ) : (
            <p className={styles.loading}>正在準備電影感示範素材…</p>
          )}
          {watermarkMode !== 'none' ? (
            <div className={styles.watermarkPreview} role="status" aria-live="polite">
              <strong>示範浮水印</strong>
              <span>
                {watermarkMode === 'dynamic' ? '動態追蹤 · 00:05' : '固定識別 · MEDIA LAB'}
              </span>
            </div>
          ) : null}
          <p className={styles.subtitle}>前端即時預覽 · 不代表後端成品</p>
        </div>
      </div>
      {job?.status === 'ready' && job.artifactUrl ? (
        <div className={styles.artifact} data-tour="composition-result">
          <div>
            <strong>FFmpeg 實際成品</strong>
            <span>已完成、可播放、可下載</span>
          </div>
          <video controls autoPlay muted loop playsInline src={artifactUrl(job.artifactUrl)} />
        </div>
      ) : null}
    </section>
  );
}
