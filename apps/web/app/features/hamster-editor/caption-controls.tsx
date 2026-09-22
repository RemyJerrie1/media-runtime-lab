'use client';
import { useEffect, useState } from 'react';
import { hamsterCaptionSchema, type HamsterCaption } from '@media-lab/contracts';
import styles from './hamster-editor.module.css';

export function CaptionControls({
  caption,
  onApply,
  onDraftChange,
}: {
  caption: HamsterCaption;
  onApply: (caption: HamsterCaption) => void;
  onDraftChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(caption);
  useEffect(() => {
    setDraft(caption);
    onDraftChange(false);
  }, [caption, onDraftChange]);
  const result = hamsterCaptionSchema.safeParse(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(caption);
  function update(next: HamsterCaption) {
    setDraft(next);
    onDraftChange(JSON.stringify(next) !== JSON.stringify(caption));
  }
  return (
    <fieldset className={styles.captionControls}>
      <legend>一句字幕</legend>
      <label>
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(event) => update({ ...draft, enabled: event.target.checked })}
        />{' '}
        顯示字幕
      </label>
      <label>
        字幕文字
        <textarea
          aria-label="字幕文字"
          rows={3}
          value={draft.text}
          onChange={(event) => update({ ...draft, text: event.target.value })}
        />
      </label>
      <p className={styles.note}>
        中英文、數字與標點，最多 40 字；每行 20 字自動換行，最多兩行。固定底部安全區。
      </p>
      <div className={styles.actions}>
        <label>
          開始秒數
          <input
            aria-label="字幕開始秒數"
            type="number"
            min="0"
            max="5"
            step="0.01"
            value={Number.isNaN(draft.start) ? '' : draft.start}
            onChange={(event) => update({ ...draft, start: event.target.valueAsNumber })}
          />
        </label>
        <label>
          結束秒數
          <input
            aria-label="字幕結束秒數"
            type="number"
            min="0"
            max="5"
            step="0.01"
            value={Number.isNaN(draft.end) ? '' : draft.end}
            onChange={(event) => update({ ...draft, end: event.target.valueAsNumber })}
          />
        </label>
      </div>
      <label>
        字幕字級 <output>{draft.fontSize}</output>
        <input
          aria-label="字幕字級"
          type="range"
          min="32"
          max="52"
          step="1"
          value={draft.fontSize}
          onChange={(event) => update({ ...draft, fontSize: Number(event.target.value) })}
        />
      </label>
      <label className={styles.color}>
        字幕文字色
        <input
          aria-label="字幕文字色"
          type="color"
          value={draft.color}
          onChange={(event) => update({ ...draft, color: event.target.value })}
        />
      </label>
      <label className={styles.color}>
        字幕底色
        <input
          aria-label="字幕底色"
          type="color"
          value={draft.background}
          onChange={(event) => update({ ...draft, background: event.target.value })}
        />
      </label>
      {!result.success && (
        <p role="alert" className={styles.note}>
          字幕未套用：{result.error.issues[0]?.message} 時間須為 0 ≤ 開始 &lt; 結束 ≤ 5 秒。
        </p>
      )}
      {dirty && <p className={styles.note}>字幕草稿尚未套用；套用後再保存場景。</p>}
      <button
        type="button"
        disabled={!result.success || !dirty}
        onClick={() => {
          if (result.success) onApply(result.data);
        }}
      >
        套用字幕
      </button>
      {dirty && (
        <button type="button" onClick={() => update(caption)}>
          捨棄字幕草稿
        </button>
      )}
    </fieldset>
  );
}
