'use client';

import type { FfmpegEncoding, MediaAsset, MediaProcessing } from '@media-lab/contracts';
import { useEffect, useState, type ChangeEvent } from 'react';
import { Button } from '../../design-system/button';
import { MetricCard } from '../../design-system/metric-card';
import { ProgressBar } from '../../design-system/progress-bar';
import { useRenderJob } from '../../shared/hooks/use-render-job';
import { artifactUrl, getDemoMedia, uploadMedia } from '../../shared/api/render-jobs';
import { EncodingDecision } from './encoding-decision';

const pipeline = ['檢測', '剪輯', '編碼', '封裝', '驗證', '儲存', '交付', '播放'];
const defaults: MediaProcessing = {
  frameRateMode: 'cfr',
  audioSampleRate: 48000,
  audioSync: 'async-resample',
  subtitleMode: 'webvtt',
  watermarkMode: 'visible',
  adInsertion: 'none',
  fastStart: true,
  deliveryFormat: 'hls-cmaf',
  abrLadder: 'standard',
  qualityMetric: 'vmaf',
};

export function RenderLab() {
  const { job, busy, error, run } = useRenderJob();
  const [trimStartSeconds, setTrimStartSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(18);
  const [encoding, setEncoding] = useState<FfmpegEncoding>({
    codec: 'libx264',
    preset: 'medium',
    rateControl: 'crf',
    crf: 23,
    bitrateKbps: 4000,
    gop: 60,
    fps: 30,
  });
  const [processing, setProcessing] = useState<MediaProcessing>(defaults);
  const [sourceAsset, setSourceAsset] = useState<MediaAsset | null>(null);
  const [usingDemo, setUsingDemo] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [playbackRendition, setPlaybackRendition] = useState('720p');
  const selectedRendition = job?.renditions.find((rendition) => rendition.id === playbackRendition);
  useEffect(() => {
    if (!job?.status) return;
    window.dispatchEvent(new CustomEvent('media-lab:render-state', { detail: job.status }));
  }, [job?.status]);
  useEffect(() => {
    let active = true;
    setUploading(true);
    getDemoMedia()
      .then((asset) => {
        if (active) setSourceAsset(asset);
      })
      .catch((cause) => {
        if (active) setUploadError(cause instanceof Error ? cause.message : '示範素材準備失敗');
      })
      .finally(() => {
        if (active) setUploading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const encode =
    (field: keyof Omit<FfmpegEncoding, 'codec'>) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setEncoding(
        (current) =>
          ({
            ...current,
            [field]:
              field === 'preset' || field === 'rateControl'
                ? event.target.value
                : Number(event.target.value),
          }) as FfmpegEncoding,
      );
  const process =
    (field: keyof MediaProcessing) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setProcessing(
        (current) =>
          ({
            ...current,
            [field]:
              event.target instanceof HTMLInputElement && event.target.type === 'checkbox'
                ? event.target.checked
                : field === 'audioSampleRate'
                  ? Number(event.target.value)
                  : event.target.value,
          }) as MediaProcessing,
      );
  const keyframeSeconds = (encoding.gop / encoding.fps).toFixed(1);
  const rateArgs =
    encoding.rateControl === 'crf' ? `-crf ${encoding.crf}` : `-b:v ${encoding.bitrateKbps}k`;
  const command = `ffmpeg -ss ${trimStartSeconds} -i input.mp4 -t ${durationSeconds} -c:v libx264 -preset ${encoding.preset} ${rateArgs} -g ${encoding.gop} -r ${encoding.fps} ${processing.fastStart ? '-movflags +faststart ' : ''}output.mp4`;
  return (
    <section className="lab" id="render-lab">
      <div className="lab-copy">
        <p className="eyebrow">互動式影音工程工作台</p>
        <h2>剪輯、編碼、交付，並理解每一項取捨。</h2>
        <div className="pipeline-strip" aria-label="媒體處理管線（Media processing pipeline）">
          {pipeline.map((step, index) => (
            <span key={step}>
              <b>{index + 1}</b>
              {step}
            </span>
          ))}
        </div>
        <EncodingDecision input={encoding} measuredRenditions={job?.renditions ?? []} />
        <fieldset className="source-upload" data-tour="choose-source">
          <legend>1. 選擇來源素材</legend>
          <div className="source-picker">
            <div className="source-preview">
              {sourceAsset ? (
                <video controls muted preload="metadata" src={artifactUrl(sourceAsset.url)}>
                  您的瀏覽器不支援影片播放。
                </video>
              ) : (
                <div className="source-loading">正在準備示範素材…</div>
              )}
            </div>
            <div className="source-details">
              <span className="artifact-badge">{usingDemo ? '內建示範素材' : '自訂素材'}</span>
              <h3>{sourceAsset?.fileName ?? '正在載入影片'}</h3>
              <p>
                {sourceAsset
                  ? `MP4 · ${(sourceAsset.sizeBytes / 1024 / 1024).toFixed(2)} MB · 已可交給後端 Worker`
                  : '後端正在建立可直接操作的預設素材。'}
              </p>
              <div className="source-actions">
                <Button
                  type="button"
                  disabled={uploading}
                  onClick={async () => {
                    setUploading(true);
                    setUploadError(null);
                    try {
                      setSourceAsset(await getDemoMedia());
                      setUsingDemo(true);
                    } catch (cause) {
                      setUploadError(cause instanceof Error ? cause.message : '示範素材準備失敗');
                    } finally {
                      setUploading(false);
                    }
                  }}
                >
                  使用這支示範影片
                </Button>
                <label className="source-file-button">
                  換成自己的影片
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      setUploadError(null);
                      try {
                        setSourceAsset(await uploadMedia(file));
                        setUsingDemo(false);
                      } catch (cause) {
                        setUploadError(cause instanceof Error ? cause.message : '素材上傳失敗');
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                </label>
              </div>
              <small>支援 MP4／MOV／WebM／MKV，最大 200 MB</small>
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>剪輯與編碼</legend>
          <div className="editor-grid">
            <label>
              剪輯起點
              <input
                aria-label="剪輯起點秒數"
                type="number"
                min="0"
                max="3600"
                step="0.5"
                value={trimStartSeconds}
                onChange={(event) => setTrimStartSeconds(Number(event.target.value))}
              />
              <small>使用 FFmpeg -ss 指定定位點</small>
            </label>
            <label>
              輸出長度
              <input
                aria-label="輸出長度秒數"
                type="number"
                min="3"
                max="120"
                value={durationSeconds}
                onChange={(event) => setDurationSeconds(Number(event.target.value))}
              />
              <small>使用 FFmpeg -t 指定秒數</small>
            </label>
            <label>
              影格率（FPS）
              <input
                aria-label="每秒影格數"
                type="number"
                min="12"
                max="120"
                value={encoding.fps}
                onChange={encode('fps')}
              />
              <small>固定影格率（CFR）輸出節奏</small>
            </label>
            <label data-tour="adjust-crf">
              固定品質（CRF）<output>{encoding.crf}</output>
              <input
                aria-label="固定品質係數 CRF"
                type="range"
                min="0"
                max="51"
                value={encoding.crf}
                onChange={encode('crf')}
              />
              <small>數值越低，品質與檔案通常越大</small>
            </label>
            <label>
              圖像群組（GOP · `-g`）
              <input
                aria-label="圖像群組長度 GOP"
                type="number"
                min="1"
                max="600"
                value={encoding.gop}
                onChange={encode('gop')}
              />
              <small>關鍵影格間隔（Keyframe Interval）≈ {keyframeSeconds} 秒</small>
            </label>
            <label data-tour="choose-preset">
              編碼速度預設（Preset）
              <select
                aria-label="FFmpeg 編碼預設"
                value={encoding.preset}
                onChange={encode('preset')}
              >
                <option value="fast">快速</option>
                <option value="medium">平衡</option>
                <option value="slow">精細</option>
              </select>
              <small>編碼速度與壓縮效率的取捨</small>
            </label>
            <label>
              碼率控制
              <select
                aria-label="碼率控制模式"
                value={encoding.rateControl}
                onChange={encode('rateControl')}
              >
                <option value="crf">固定品質（CRF）</option>
                <option value="bitrate">目標碼率（Bitrate）</option>
              </select>
              <small>選擇品質目標或傳輸預算</small>
            </label>
            <label>
              影片碼率（kbps）
              <input
                aria-label="影片碼率 kbps"
                aria-describedby="bitrate-help"
                type="number"
                min="200"
                max="50000"
                value={encoding.bitrateKbps}
                disabled={encoding.rateControl !== 'bitrate'}
                onChange={encode('bitrateKbps')}
              />
              <small id="bitrate-help">
                {encoding.rateControl === 'bitrate'
                  ? '目前用來控制輸出碼率'
                  : 'CRF 模式不使用此欄位'}
              </small>
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>同步、水印與交付</legend>
          <div className="editor-grid">
            <label>
              影格率模式（Frame Rate）
              <select
                aria-label="影格率模式"
                value={processing.frameRateMode}
                onChange={process('frameRateMode')}
              >
                <option value="cfr">固定影格率（CFR）</option>
                <option value="vfr">可變影格率（VFR）</option>
              </select>
              <small>CFR 較適合拼接（Concat）與同步</small>
            </label>
            <label>
              音畫同步（A/V Sync）
              <select
                aria-label="音畫同步模式"
                value={processing.audioSync}
                onChange={process('audioSync')}
              >
                <option value="passthrough">直接通過（Passthrough）</option>
                <option value="async-resample">非同步重採樣（Async Resample）</option>
              </select>
              <small>修正輕微的音畫漂移（Drift）</small>
            </label>
            <label>
              音訊取樣率（Sample Rate）
              <select
                aria-label="音訊取樣率"
                value={processing.audioSampleRate}
                onChange={process('audioSampleRate')}
              >
                <option value="44100">44.1 kHz</option>
                <option value="48000">48 kHz</option>
              </select>
              <small>保持來源與輸出時間基準一致</small>
            </label>
            <label>
              字幕（Subtitles）
              <select
                aria-label="字幕模式"
                value={processing.subtitleMode}
                onChange={process('subtitleMode')}
              >
                <option value="none">無（None）</option>
                <option value="burn-in">燒錄字幕（Burn-in）</option>
                <option value="webvtt">WebVTT 外掛字幕</option>
              </select>
            </label>
            <label>
              影音水印（Watermark）
              <select
                aria-label="影音水印模式"
                value={processing.watermarkMode}
                onChange={process('watermarkMode')}
              >
                <option value="none">無（None）</option>
                <option value="visible">可視水印（Visible）</option>
                <option value="dynamic">動態鑑識水印（Dynamic Forensic）</option>
              </select>
            </label>
            <label>
              廣告插入（Ad Insertion）
              <select
                aria-label="廣告插入模式"
                value={processing.adInsertion}
                onChange={process('adInsertion')}
              >
                <option value="none">無（None）</option>
                <option value="csai">用戶端插入（CSAI）</option>
                <option value="ssai">伺服器端標記（SSAI）</option>
              </select>
            </label>
            <label className="check" data-tour="toggle-faststart">
              <input
                aria-label="MP4 快速啟播"
                type="checkbox"
                checked={processing.fastStart}
                onChange={process('fastStart')}
              />
              MP4 快速啟播（Faststart）<small>將 moov 移至 mdat 前方</small>
            </label>
            <label data-tour="delivery-format">
              交付格式
              <select
                aria-label="交付格式"
                value={processing.deliveryFormat}
                onChange={process('deliveryFormat')}
              >
                <option value="mp4">單一 MP4</option>
                <option value="hls-cmaf">HLS + CMAF 串流</option>
              </select>
              <small>Master Playlist 搭配 fragmented MP4 分段</small>
            </label>
            <label data-tour="abr-ladder">
              ABR Ladder
              <select
                aria-label="多碼率階梯"
                value={processing.abrLadder}
                disabled={processing.deliveryFormat !== 'hls-cmaf'}
                onChange={process('abrLadder')}
              >
                <option value="none">不建立</option>
                <option value="standard">360p／540p／720p／1080p</option>
              </select>
              <small>覆蓋不同頻寬與裝置解析度</small>
            </label>
            <label data-tour="quality-metric">
              畫質驗證
              <select
                aria-label="畫質驗證指標"
                value={processing.qualityMetric}
                onChange={process('qualityMetric')}
              >
                <option value="none">不測量</option>
                <option value="vmaf">VMAF 實測</option>
              </select>
              <small>逐一比較來源與每個 Rendition</small>
            </label>
          </div>
        </fieldset>
        <div className="ffmpeg-command">
          <span>FFmpeg 指令預覽</span>
          <code>{command}</code>
        </div>
        <Button
          data-tour="submit-render"
          disabled={busy || uploading || !sourceAsset}
          onClick={async () => {
            if (!sourceAsset) return;
            setUploadError(null);
            try {
              await run({
                sourceAssetId: sourceAsset.id,
                template: 'landscape',
                trimStartSeconds,
                durationSeconds,
                encoding,
                processing,
              });
            } catch (cause) {
              setUploadError(cause instanceof Error ? cause.message : '素材處理失敗');
            }
          }}
        >
          {busy || uploading ? '準備中…' : '套用參數並執行 FFmpeg'}
        </Button>
        {uploadError ? (
          <p className="error" role="alert">
            {uploadError}
          </p>
        ) : null}
      </div>
      <div className="console">
        <section
          className="artifact-preview"
          aria-labelledby="artifact-preview-title"
          data-tour="artifact-result"
        >
          <div>
            <span className={job?.artifactUrl ? 'artifact-badge' : 'simulation-badge'}>
              {job?.artifactUrl ? '已完成串流交付' : '等待處理'}
            </span>
            <h3 id="artifact-preview-title">自適應串流成品</h3>
            <p>
              四個畫質版本由 FFmpeg 實際產生；可切換預覽，並查看本次任務的 HLS Master Playlist。
            </p>
          </div>
          {job?.artifactUrl ? (
            <>
              {job.renditions.length ? (
                <label data-tour="rendition-switcher">
                  預覽 Rendition
                  <select
                    aria-label="選擇預覽畫質"
                    value={playbackRendition}
                    onChange={(event) => setPlaybackRendition(event.target.value)}
                  >
                    {job.renditions.map((rendition) => (
                      <option key={rendition.id} value={rendition.id}>
                        {rendition.id} · {rendition.bitrateKbps.toLocaleString()} kbps
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <video
                key={`${job.id}-${playbackRendition}`}
                controls
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                src={artifactUrl(
                  job.renditions.length
                    ? `/streams/${job.id}/${playbackRendition}.mp4`
                    : job.artifactUrl,
                )}
              >
                您的瀏覽器不支援影片播放。
              </video>
              {selectedRendition ? (
                <dl className="rendition-receipt" aria-label="目前畫質的交付證據">
                  <div>
                    <dt>解析度</dt>
                    <dd>
                      {selectedRendition.width} × {selectedRendition.height}
                    </dd>
                  </div>
                  <div>
                    <dt>碼率</dt>
                    <dd>{selectedRendition.bitrateKbps.toLocaleString()} kbps</dd>
                  </div>
                  <div>
                    <dt>VMAF</dt>
                    <dd>
                      {selectedRendition.vmaf === null
                        ? '此環境無法量測'
                        : selectedRendition.vmaf.toFixed(1)}
                    </dd>
                  </div>
                  <div>
                    <dt>Checksum</dt>
                    <dd>{selectedRendition.checksum}</dd>
                  </div>
                </dl>
              ) : null}
              {job.manifestUrl ? (
                <a
                  data-tour="hls-manifest"
                  href={artifactUrl(job.manifestUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  開啟 HLS Master Playlist
                </a>
              ) : null}
            </>
          ) : (
            <p className="artifact-empty">尚未產生實體影片。</p>
          )}
        </section>
        <div className="job" data-tour="render-result">
          <MetricCard
            label="任務狀態（Job Status）"
            value={job?.status.toUpperCase() ?? '尚未開始'}
            tone={job?.status === 'ready' ? 'success' : 'accent'}
          />
          <MetricCard label="處理階段（Stage）" value={job?.stage ?? '等待指令'} />
          <MetricCard
            label="預估處理成本／Token 用量"
            value={job ? `$${job.estimatedCostUsd} / ${job.tokens}` : '—'}
          />
          {error ? (
            <p className="error job-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <ProgressBar
          label="算圖進度（Render Progress）"
          value={job?.progress ?? 0}
          tone={job?.status === 'ready' ? 'success' : 'accent'}
        />
        <div className="review-grid">
          <article>
            <span>素材檢測（Probe）</span>
            <strong>Codec · 解析度 · FPS · 長度 · Bitrate · Streams</strong>
            <p>先檢測再決定串流複製（Stream Copy）或轉碼（Transcode），不可一律重編碼。</p>
          </article>
          <article>
            <span>GOP／跳轉（Seek）</span>
            <strong>I/P/B 影格 · 隨機存取 · {keyframeSeconds} 秒間隔</strong>
            <p>短 GOP 通常提升跳轉速度；長 GOP 通常有較佳壓縮效率。</p>
          </article>
          <article>
            <span>時間與同步（Time & Sync）</span>
            <strong>PTS · DTS · Timebase · VFR/CFR · A/V Drift</strong>
            <p>驗證時間戳單調遞增，並比較音訊與影片長度。</p>
          </article>
          <article>
            <span>播放（Playback）</span>
            <strong>moov · Range · Buffer · Demux／Decode</strong>
            <p>成品編碼成功，不代表啟播速度與緩衝體驗一定正常。</p>
          </article>
          <article>
            <span>影音水印（Watermark）</span>
            <strong>可視 · 隱形 · 動態／鑑識</strong>
            <p>此 Demo 規劃可視與動態疊加；高韌性的隱形水印需要獨立服務。</p>
          </article>
          <article>
            <span>廣告與交付（Ads & Delivery）</span>
            <strong>CSAI · SSAI · HLS/DASH · CDN</strong>
            <p>明確區分廣告決策、Manifest、追蹤、儲存與播放器責任。</p>
          </article>
        </div>
        {job ? (
          <div className="encode-receipt" aria-live="polite">
            <span>後端處理收據（Backend Processing Receipt）</span>
            <strong>
              {job.encoding.codec} · {job.encoding.fps}fps · CRF {job.encoding.crf} · GOP{' '}
              {job.encoding.gop} · {job.processing.frameRateMode.toUpperCase()}
            </strong>
            <code>ffprobe {job.ffprobeArgs.join(' ')}</code>
            <code>ffmpeg {job.ffmpegArgs.join(' ')}</code>
            <code>request-id {job.requestId}</code>
            {job.manifestUrl ? <code>manifest {job.manifestUrl}</code> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
