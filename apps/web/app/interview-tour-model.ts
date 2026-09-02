export type TourTabId =
  'overview' | 'render' | 'composition' | 'cost' | 'operations' | 'architecture';

export type TourCompletion =
  | { type: 'manual' }
  | { type: 'click' }
  | { type: 'input'; validate?: (element: HTMLInputElement | HTMLSelectElement) => boolean }
  | { type: 'event'; name: string }
  | { type: 'route'; pathname: string }
  | {
      type: 'state';
      name: string;
      matches: (detail: unknown) => boolean;
      rejects?: (detail: unknown) => boolean;
      retryStep?: number;
    };

export type InterviewTourStep = {
  id: string;
  target: `[data-tour="${string}"]`;
  title: string;
  instruction: string;
  completion: TourCompletion;
  tab: TourTabId;
  placement?: 'top' | 'right' | 'bottom' | 'left';
};

export const interviewTourSteps: InterviewTourStep[] = [
  {
    id: 'overview-summary',
    target: '[data-tour="overview-summary"]',
    title: '作品解決什麼？',
    instruction: '從媒體處理、工作流復原到成本治理，先掌握完整範圍。',
    completion: { type: 'manual' },
    tab: 'overview',
    placement: 'left',
  },
  {
    id: 'open-workbench',
    target: '[data-tour="tab-render"]',
    title: '進入影音工作台',
    instruction: '點擊頁籤，開始一次真實轉檔。',
    completion: { type: 'click' },
    tab: 'overview',
    placement: 'right',
  },
  {
    id: 'choose-source',
    target: '[data-tour="choose-source"]',
    title: '選擇來源影片',
    instruction: '示範影片已就緒。直接使用，或換成自己的影片。',
    completion: { type: 'click' },
    tab: 'render',
    placement: 'right',
  },
  {
    id: 'adjust-quality',
    target: '[data-tour="adjust-crf"]',
    title: '設定畫質',
    instruction: '調整 CRF：越低畫質越高，檔案也越大。',
    completion: { type: 'manual' },
    tab: 'render',
    placement: 'right',
  },
  {
    id: 'choose-preset',
    target: '[data-tour="choose-preset"]',
    title: '選擇編碼速度',
    instruction: '切換 Preset，比較速度與壓縮效率。',
    completion: { type: 'manual' },
    tab: 'render',
    placement: 'left',
  },
  {
    id: 'toggle-faststart',
    target: '[data-tour="toggle-faststart"]',
    title: '改善啟播',
    instruction: 'Faststart 已採用推薦設定，可直接下一步。',
    completion: { type: 'manual' },
    tab: 'render',
    placement: 'right',
  },
  {
    id: 'submit-render',
    target: '[data-tour="submit-render"]',
    title: '開始轉檔',
    instruction: '送出參數，由後端 FFmpeg 產生 MP4。',
    completion: { type: 'click' },
    tab: 'render',
    placement: 'top',
  },
  {
    id: 'render-result',
    target: '[data-tour="render-result"]',
    title: '等待處理完成',
    instruction: 'Worker 正在轉檔與驗證成品。',
    completion: {
      type: 'state',
      name: 'media-lab:render-state',
      matches: (detail) => detail === 'ready',
      rejects: (detail) => detail === 'failed' || detail === 'unavailable',
    },
    tab: 'render',
    placement: 'left',
  },
  {
    id: 'artifact-result',
    target: '[data-tour="artifact-result"]',
    title: '這是真實轉檔結果',
    instruction: '影片已由 FFmpeg 產生並開始播放。看完再繼續。',
    completion: { type: 'manual' },
    tab: 'render',
    placement: 'left',
  },
  {
    id: 'open-composition',
    target: '[data-tour="tab-composition"]',
    title: '前往媒體合成',
    instruction: '查看字幕、精靈圖與圖層時間軸。',
    completion: { type: 'click' },
    tab: 'render',
    placement: 'right',
  },
  {
    id: 'inspect-composition',
    target: '[data-tour="composition-options"]',
    title: '選擇合成方式',
    instruction: '選擇固定或動態浮水印。右側可先看草稿。',
    completion: { type: 'manual' },
    tab: 'composition',
    placement: 'left',
  },
  {
    id: 'run-composition',
    target: '[data-tour="composition-submit"]',
    title: '執行真實合成',
    instruction: '按下按鈕，由本機 FFmpeg 產生新影片。',
    completion: { type: 'click' },
    tab: 'composition',
    placement: 'right',
  },
  {
    id: 'composition-result',
    target: '[data-tour="composition-result"]',
    title: '查看後端成品',
    instruction: '這是 FFmpeg 實際輸出的影片。播放確認後再繼續。',
    completion: { type: 'manual' },
    tab: 'composition',
    placement: 'left',
  },
  {
    id: 'open-cost',
    target: '[data-tour="tab-cost"]',
    title: '前往人工智慧成本',
    instruction: '查看用量、歸因與預算控制。',
    completion: { type: 'click' },
    tab: 'composition',
    placement: 'right',
  },
  {
    id: 'inspect-cost',
    target: '[data-tour="cost-content"]',
    title: '試算預算決策',
    instruction: '切換情境或預算，查看放行、告警或停止的結果。此處不呼叫 AI。',
    completion: { type: 'manual' },
    tab: 'cost',
    placement: 'left',
  },
  {
    id: 'open-operations',
    target: '[data-tour="tab-operations"]',
    title: '前往維運證據',
    instruction: '查看任務追蹤、復原與驗證。',
    completion: { type: 'click' },
    tab: 'cost',
    placement: 'right',
  },
  {
    id: 'inspect-operations',
    target: '[data-tour="operations-content"]',
    title: '讀取真實維運資料',
    instruction: '按下按鈕，直接向本機 API 取得執行快照。',
    completion: { type: 'click' },
    tab: 'operations',
    placement: 'left',
  },
  {
    id: 'operations-result',
    target: '[data-tour="operations-result"]',
    title: '理解維運結果',
    instruction: '這些數字來自目前執行中的後端，不是固定文案。',
    completion: { type: 'manual' },
    tab: 'operations',
    placement: 'left',
  },
  {
    id: 'open-architecture',
    target: '[data-tour="tab-architecture"]',
    title: '前往系統架構',
    instruction: '檢視前端、API、Worker 與成品服務。',
    completion: { type: 'click' },
    tab: 'operations',
    placement: 'right',
  },
  {
    id: 'inspect-architecture',
    target: '[data-tour="architecture-content"]',
    title: '掌握責任邊界',
    instruction: '介面送出合約，Worker 產生成品，靜態服務負責播放。',
    completion: { type: 'manual' },
    tab: 'architecture',
    placement: 'left',
  },
];

export function moveTourStep(current: number, direction: -1 | 1) {
  return Math.min(Math.max(current + direction, 0), interviewTourSteps.length - 1);
}
