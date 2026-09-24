'use client';

import { RecoverableVideo } from '../../shared/ui/recoverable-video';
import { audibleSceneAudio, type HamsterScene } from '@media-lab/contracts';
import { useSceneExport } from './use-scene-export';
import { sceneVideoUrl } from './scene-export-api';
import styles from './hamster-editor.module.css';

const labels = {
  accepted: '等待輸出',
  rendering: '正在繪製畫面',
  encoding: '編碼與檢查影片',
  ready: '影片已完成',
  failed: '輸出失敗',
  cancelled: '已取消輸出',
};
export function SceneExport({ scene, disabled }: { scene: HamsterScene; disabled: boolean }) {
  const flow = useSceneExport();
  const job = flow.job;
  return (
    <section className={styles.exportPanel} aria-label="影片輸出">
      <h2>把五秒鐘帶走</h2>
      <p className={styles.note}>
        640 × 360 · 24 fps · 5 秒 · {audibleSceneAudio(scene) ? '有聲' : '無聲'}{' '}
        MP4。輸出送出當下的場景；之後編輯不會改動這筆任務。
      </p>
      <button type="button" disabled={disabled || !flow.canStart} onClick={() => flow.start(scene)}>
        匯出目前場景 MP4
      </button>
      {disabled && <p className={styles.note}>請先完成字幕套用或音檔上傳，再輸出影片。</p>}
      {flow.hasIntent && !job && !flow.error && <p role="status">正在找回或建立原輸出任務…</p>}
      {job && (
        <>
          <p role="status">
            {labels[job.status]} · 已繪製 {job.completedFrames} / 120 幀 · 第 {job.attempt} 次執行
          </p>
          <progress aria-label="影片輸出進度" value={job.completedFrames} max={120} />
          <p className={styles.note}>
            任務 <span data-testid="scene-job-id">{job.id}</span> · sequence {job.sequence}
          </p>
          {job.error && <p role="alert">{job.error}</p>}
          {['accepted', 'rendering', 'encoding'].includes(job.status) && (
            <button type="button" onClick={() => flow.act('cancel')}>
              取消輸出
            </button>
          )}
          {job.status === 'failed' && (
            <button type="button" onClick={() => flow.act('retry')}>
              重試此輸出任務
            </button>
          )}
          {job.receipt && (
            <>
              <RecoverableVideo
                aria-label="倉鼠輸出影片"
                controls
                playsInline
                preload="metadata"
                src={sceneVideoUrl(job.receipt.artifactUrl)}
              />
              <a href={`${sceneVideoUrl(job.receipt.artifactUrl)}?download=1`}>下載倉鼠 MP4</a>
              <details>
                <summary>影片檢查結果</summary>
                <p>
                  640 × 360 · {job.receipt.fps} fps · {job.receipt.frameCount} 幀 ·{' '}
                  {job.receipt.durationSeconds.toFixed(3)} 秒 · {job.receipt.sizeBytes} bytes ·
                  {job.receipt.audioStreams ? 'AAC 音軌' : '無音軌'}
                </p>
                <p>場景指紋：{job.receipt.sceneFingerprint}</p>
                <p>渲染版本：{job.receipt.rendererVersion}</p>
                <p>{job.receipt.checksum}</p>
              </details>
            </>
          )}
        </>
      )}
      {flow.error && (
        <div role="alert">
          <p>{flow.error}</p>
          {flow.hasIntent && (
            <button type="button" onClick={() => flow.act('resume')}>
              重試原輸出操作
            </button>
          )}
          <button type="button" onClick={flow.discard}>
            清除本機輸出紀錄
          </button>
        </div>
      )}
    </section>
  );
}
