'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { HAMSTER_SCENE_MAX_BYTES, type HamsterScene } from '@media-lab/contracts';
import { defaultScene, parseScene, serializeScene, SCENE_STORAGE_KEY } from './scene-model';
import { loadScene, saveScene } from './scene-storage';
import { HamsterPreview } from './hamster-preview';
import styles from './hamster-editor.module.css';

const controls = [
  ['x', '左右位置', -1.2, 1.2, 0.05],
  ['z', '前後位置', -1.2, 1.2, 0.05],
  ['heading', '朝向', -180, 180, 1],
  ['scale', '大小', 0.65, 1.25, 0.05],
] as const;

export function HamsterEditor() {
  const [scene, setScene] = useState<HamsterScene>(defaultScene);
  const [baseline, setBaseline] = useState(() => serializeScene(defaultScene()));
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const revision = useRef(0);
  const mounted = useRef(false);
  const dirty = serializeScene(scene) !== baseline;
  useEffect(() => {
    mounted.current = true;
    try {
      const saved = loadScene(window.localStorage);
      if (saved) {
        setScene(saved);
        setBaseline(serializeScene(saved));
        setMessage('已載入本機保存的場景。');
      } else setMessage('先擺好倉鼠，再保存你的第一個場景。');
    } catch {
      setError('無法讀取本機場景。原始資料未被覆寫，你仍可編輯與匯出 JSON。');
    }
    setLoaded(true);
    return () => {
      mounted.current = false;
      revision.current++;
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const navigation = (event: Event) => {
      if (!window.confirm('場景尚未保存，確定離開並捨棄變更？')) event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('media-lab:before-navigate', navigation);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('media-lab:before-navigate', navigation);
    };
  }, [dirty]);
  function change(next: HamsterScene) {
    revision.current++;
    setScene(next);
    setError('');
    setMessage('');
  }
  function save() {
    try {
      if (
        window.localStorage.getItem(SCENE_STORAGE_KEY) !== null &&
        !window.confirm('要以目前場景覆寫本機保存的場景嗎？')
      )
        return;
      saveScene(window.localStorage, scene);
      setBaseline(serializeScene(scene));
      setError('');
      setMessage('場景已保存於此瀏覽器。');
    } catch {
      setError('保存失敗：瀏覽器儲存空間不可用。請匯出 JSON 保留目前場景。');
    }
  }
  function exportScene() {
    const url = URL.createObjectURL(
      new Blob([serializeScene(scene)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hamster-scene.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage('已匯出場景 JSON；本機保存狀態維持不變。');
  }
  async function importScene(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const started = revision.current;
    try {
      if (file.size > HAMSTER_SCENE_MAX_BYTES) throw new Error('場景檔案不能超過 16 KB。');
      const next = parseScene(await file.text());
      if (!mounted.current) return;
      if (revision.current !== started) {
        setError('讀取期間場景已變更，請重新選擇檔案匯入。');
        return;
      }
      if (!window.confirm('要用匯入的場景取代目前畫面嗎？本機保存內容會保留到你按下保存。')) return;
      change(next);
      setMessage('已匯入場景，按下保存可保留至下次開啟。');
    } catch (reason) {
      if (mounted.current && revision.current === started)
        setError(reason instanceof Error ? reason.message : '場景匯入失敗。');
    }
  }
  return (
    <section className={styles.editor}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">HAMSTER STUDIO · 01</p>
          <h1>給倉鼠一個小舞台</h1>
          <p>調整位置與朝向，留下屬於你的場景。</p>
        </div>
        <span className={styles.badge}>{dirty ? '尚未保存' : '沒有未保存變更'}</span>
      </header>
      <div className={styles.layout}>
        <div className={styles.stage}>
          <div className={styles.stageHeading}>
            <strong>場景預覽</strong>
            <span>固定鏡頭 · 16:9</span>
          </div>
          <HamsterPreview scene={scene} />
          <p className={styles.note}>一隻倉鼠，一個舞台。腳掌始終貼齊地面。</p>
        </div>
        <fieldset className={styles.controls} disabled={!loaded}>
          <legend>場景設定</legend>
          {controls.map(([key, label, min, max, step]) => (
            <label key={key}>
              <span>
                {label}
                <output>
                  {key === 'heading'
                    ? `${scene.transform[key]}°`
                    : `${scene.transform[key].toFixed(2)}${key === 'scale' ? '×' : ''}`}
                </output>
              </span>
              <input
                aria-label={label}
                type="range"
                min={min}
                max={max}
                step={step}
                value={scene.transform[key]}
                onChange={(event) =>
                  change({
                    ...scene,
                    transform: { ...scene.transform, [key]: Number(event.target.value) },
                  })
                }
              />
            </label>
          ))}
          <label className={styles.color}>
            <span>背景顏色</span>
            <input
              aria-label="背景顏色"
              type="color"
              value={scene.background}
              onChange={(event) => change({ ...scene, background: event.target.value })}
            />
          </label>
          <button className={styles.primary} type="button" onClick={save}>
            保存場景
          </button>
          <div className={styles.actions}>
            <button type="button" onClick={exportScene}>
              匯出 JSON
            </button>
            <label className={styles.import}>
              匯入 JSON
              <input
                aria-label="匯入 JSON"
                type="file"
                accept=".json,application/json"
                onChange={importScene}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('確定重設為預設場景？目前變更會被取代，本機保存內容暫不變。'))
                change(defaultScene());
            }}
          >
            重設場景
          </button>
          <p className={styles.note}>保存在此瀏覽器。匯出 JSON 可備份或帶到另一台裝置。</p>
        </fieldset>
      </div>
      {message && (
        <p role="status" className={styles.message}>
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </section>
  );
}
