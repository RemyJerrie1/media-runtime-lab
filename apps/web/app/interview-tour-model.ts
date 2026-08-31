export type TourTabId =
  'overview' | 'render' | 'composition' | 'cost' | 'operations' | 'architecture';

export type InterviewTourStep = {
  tab: TourTabId;
  target: string;
  eyebrow: string;
  title: string;
  action: string;
  script: string;
};

export const interviewTourSteps: InterviewTourStep[] = [
  {
    tab: 'overview',
    target: '.workspace-overview',
    eyebrow: '01 · 媒體工作流',
    title: '從內容建立走到可靠任務',
    action: '先看整體定位，再進入媒體與後端細節。',
    script:
      '這個作品把影音生成流程裡的 render job 抽出來做深：處理媒體參數，也管理非同步狀態、復原與成品紀錄。範圍是 media processing control plane。',
  },
  {
    tab: 'composition',
    target: '#composition',
    eyebrow: '02 · Timeline 與合成',
    title: '素材必須落在同一條媒體時鐘',
    action: '播放時間軸，觀察字幕 cue、frame identity 與場景切換。',
    script:
      '圖片、字幕與音訊不是排進陣列就完成；它們需要共同的 duration、timebase 與 frame mapping。這裡用媒體時鐘驅動字幕 cue 與 Canvas 合成，而不是依賴不穩定的 timer。',
  },
  {
    tab: 'render',
    target: '#render-lab',
    eyebrow: '03 · FFmpeg 處理計畫',
    title: '編碼參數代表產品取捨',
    action: '切換 CRF／bitrate，調整 GOP 或 FPS，送出任務後查看處理收據。',
    script:
      'CRF 用品質作目標，bitrate 用傳輸預算作目標；GOP 會影響壓縮效率與 seek。後端驗證並保存 FFmpeg 參數計畫；這個版本沒有假裝已經執行真實轉檔。',
  },
  {
    tab: 'operations',
    target: '#panel-operations',
    eyebrow: '04 · Production Reliability',
    title: '避免重複轉碼與進度遺失',
    action: '指著三項證據：冪等、worker 接手、SSE 重播。',
    script:
      '同一個指令送幾次都只有一個 job，避免重複轉碼成本；worker 掛掉後由 lease 過期接手；連線斷了從 Last-Event-ID 接回事件。CI 會用真正的 PostgreSQL 驗證。',
  },
  {
    tab: 'architecture',
    target: '.workspace-architecture',
    eyebrow: '05 · 邊界與延伸',
    title: '從媒體處理延伸到 OTT',
    action: '由左到右講 API、job state、lease/outbox 與 worker。',
    script:
      '現在做到 Create、Compose、Process 的可靠控制；下一步才是接真實 worker，往 Encode、Segment、Deliver、Playback 延伸。HLS/DASH、ABR、DRM 與廣告插入是明確的下一層，不是這個作品已完成的功能。',
  },
];

export function moveTourStep(current: number, direction: -1 | 1) {
  return Math.min(Math.max(current + direction, 0), interviewTourSteps.length - 1);
}
