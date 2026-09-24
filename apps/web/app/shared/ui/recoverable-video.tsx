'use client';

import { useEffect, useRef, useState, type VideoHTMLAttributes } from 'react';

type Props = VideoHTMLAttributes<HTMLVideoElement> & { src: string; 'aria-label': string };

export function RecoverableVideo(props: Props) {
  return <VideoAttempt key={props.src} {...props} />;
}

function VideoAttempt(props: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => {
      setReason('影片載入逾時，請檢查連線或確認原 API 已啟動。');
      setStatus('failed');
    }, 30_000);
    return () => clearTimeout(timer);
  }, [attempt, status]);
  return (
    <>
      <video
        {...props}
        ref={video}
        onLoadedMetadata={(event) => {
          setStatus('ready');
          props.onLoadedMetadata?.(event);
        }}
        onError={(event) => {
          const code = event.currentTarget.error?.code;
          setReason(
            code === 3
              ? '影片無法解碼，請重新載入或下載後使用其他播放器。'
              : code === 2
                ? '影片傳輸中斷，請檢查連線後重新載入。'
                : '影片無法載入，檔案可能無法取得或格式不受支援。',
          );
          setStatus('failed');
          props.onError?.(event);
        }}
      />
      {status === 'loading' && <p role="status">正在載入{props['aria-label']}…</p>}
      {status === 'failed' && (
        <div role="alert" aria-label={`${props['aria-label']}錯誤`}>
          <p>{reason}</p>
          <button
            type="button"
            onClick={() => {
              setStatus('loading');
              setAttempt((value) => value + 1);
              video.current?.load();
            }}
          >
            重新載入影片
          </button>
          <p>這只會重新讀取影片，不會重新建立任務。</p>
        </div>
      )}
    </>
  );
}
