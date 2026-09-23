'use client';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  audioAtTime,
  hamsterAudioSchema,
  sceneAudio,
  type HamsterAudio,
  type HamsterScene,
} from '@media-lab/contracts';
import { checkSceneAudio, uploadSceneAudio } from './scene-audio-api';
import { sceneVideoUrl } from './scene-export-api';
import styles from './hamster-editor.module.css';

export function SceneAudio({
  scene,
  time,
  playing,
  onPause,
  onApply,
  onBusy,
}: {
  scene: HamsterScene;
  time: number;
  playing: boolean;
  onPause: () => void;
  onApply: (audio: HamsterAudio | null) => void;
  onBusy: (busy: boolean) => void;
}) {
  const track = sceneAudio(scene);
  const player = useRef<HTMLAudioElement>(null);
  const upload = useRef<AbortController | null>(null);
  const request = useRef<Promise<void> | null>(null);
  const desired = useRef(false);
  const generation = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [available, setAvailable] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    // Changing/importing/resetting a scene invalidates a pending upload result.
    return () => upload.current?.abort();
  }, [scene]);
  useEffect(() => {
    const controller = new AbortController();
    generation.current++;
    request.current = null;
    setAvailable(false);
    setLoaded(false);
    setError('');
    if (track)
      void checkSceneAudio(track.asset, controller.signal)
        .then(() => {
          if (!controller.signal.aborted) setAvailable(true);
        })
        .catch((reason) => {
          if (!controller.signal.aborted)
            setError(reason instanceof Error ? reason.message : '音訊無法載入。');
        });
    return () => {
      controller.abort();
    };
  }, [track?.asset.id, track?.asset.checksum]);
  useEffect(() => {
    const element = player.current;
    if (!element || !track) return;
    const position = audioAtTime(track, time);
    const active = playing && available && loaded && position.active;
    desired.current = active;
    element.volume = track.volume;
    element.muted = track.muted;
    if (!active) element.pause();
    if (loaded && (!active || Math.abs(element.currentTime - position.sourceTime) > 0.12))
      element.currentTime = position.sourceTime;
    if (active && element.paused && !request.current) {
      const started = generation.current;
      const pending = element.play();
      request.current = pending;
      void pending
        .then(() => {
          if (started !== generation.current) return;
          if (!desired.current) element.pause();
          else setError((current) => (current.startsWith('瀏覽器未能播放音訊') ? '' : current));
        })
        .catch(() => {
          if (started === generation.current && desired.current) {
            setError('瀏覽器未能播放音訊。請再次按播放，或檢查音檔是否仍可取得。');
            onPause();
          }
        })
        .finally(() => {
          if (request.current === pending) request.current = null;
        });
    }
  }, [track, time, playing, available, loaded, onPause]);
  useEffect(() => {
    const element = player.current;
    return () => {
      desired.current = false;
      element?.pause();
    };
  }, [track?.asset.id]);
  async function select(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    upload.current?.abort();
    const controller = new AbortController();
    upload.current = controller;
    onPause();
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      const asset = await uploadSceneAudio(file, controller.signal);
      if (!controller.signal.aborted)
        onApply({
          asset,
          trimStart: 0,
          start: track?.start ?? 0,
          volume: track?.volume ?? 0.7,
          muted: false,
        });
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(reason instanceof Error ? reason.message : '上傳失敗，請重試。');
    } finally {
      if (upload.current === controller) {
        setBusy(false);
        onBusy(false);
        upload.current = null;
      }
    }
  }
  function update(change: Partial<HamsterAudio>) {
    if (!track) return;
    const parsed = hamsterAudioSchema.safeParse({ ...track, ...change });
    if (parsed.success) {
      onPause();
      onApply(parsed.data);
    }
  }
  return (
    <section className={styles.audioPanel} aria-label="場景聲音">
      <h2>替倉鼠配一段聲音</h2>
      <p className={styles.note}>
        一條 MP3／WAV，最多 10 MB、60 秒。超過五秒畫面的部分會截斷，不足的尾端保持靜音。
      </p>
      <label>
        上傳／替換音檔
        <input
          aria-label="上傳音檔"
          type="file"
          accept=".mp3,.wav,audio/mpeg,audio/wav"
          disabled={busy}
          onChange={select}
        />
      </label>
      {busy && <p role="status">正在檢查與保存音訊…</p>}
      {track && (
        <>
          <audio
            ref={player}
            aria-label="場景音訊預覽"
            preload="auto"
            src={sceneVideoUrl(track.asset.url)}
            onLoadedData={() => setLoaded(true)}
            onError={() => {
              setLoaded(false);
              setError('音訊素材遺失或無法播放，請重新上傳，或靜音／移除音軌。');
              onPause();
            }}
          />
          <p className={styles.note}>
            音檔 {track.asset.durationSeconds.toFixed(2)} 秒 ·{' '}
            {available && loaded ? '音訊已就緒' : '正在確認音訊'}
            <br />
            素材 <span data-testid="scene-audio-id">{track.asset.id}</span>
          </p>
          <label>
            音檔起點：{track.trimStart.toFixed(2)} 秒
            <input
              aria-label="音檔起點"
              type="range"
              min="0"
              max={Math.max(0, track.asset.durationSeconds - 0.01)}
              step="0.01"
              value={track.trimStart}
              onChange={(e) => update({ trimStart: Number(e.target.value) })}
            />
          </label>
          <label>
            動畫開始配音：{track.start.toFixed(2)} 秒
            <input
              aria-label="配音開始時間"
              type="range"
              min="0"
              max="4.99"
              step="0.01"
              value={track.start}
              onChange={(e) => update({ start: Number(e.target.value) })}
            />
          </label>
          <label>
            音量：{Math.round(track.volume * 100)}%
            <input
              aria-label="音訊音量"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={track.volume}
              onChange={(e) => update({ volume: Number(e.target.value) })}
            />
          </label>
          <label>
            <input
              aria-label="靜音音軌"
              type="checkbox"
              checked={track.muted}
              onChange={(e) => update({ muted: e.target.checked })}
            />{' '}
            靜音音軌（輸出無聲影片）
          </label>
          <button
            type="button"
            onClick={() => {
              onPause();
              onApply(null);
            }}
          >
            移除音軌
          </button>
        </>
      )}
      {error && (
        <p role="alert" aria-label="音訊錯誤">
          {error}
        </p>
      )}
      <p className={styles.note}>
        音檔保存在本機 API 的素材庫。場景 JSON
        只包含引用，換電腦或素材遺失時請重新上傳。播放與拖曳使用左側動畫時間軸。
      </p>
    </section>
  );
}
