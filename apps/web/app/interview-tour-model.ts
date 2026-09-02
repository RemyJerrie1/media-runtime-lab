export type TourTabId =
  'overview' | 'render' | 'composition' | 'cost' | 'operations' | 'architecture';

export type TourCompletion =
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
  placement?: 'top' | 'right' | 'bottom' | 'left';
};

export const interviewTourSteps: InterviewTourStep[] = [
  {
    id: 'overview-summary',
    target: '[data-tour="overview-summary"]',
    title: '先理解作品要解決什麼',
    instruction:
      '這裡整理媒體生命週期、工作流復原與成本治理。點擊概覽後，導覽會帶你實際操作每個頁籤。',
    completion: { type: 'click' },
    placement: 'left',
  },
  {
    id: 'open-workbench',
    target: '[data-tour="tab-render"]',
    title: '先進入影音工作台',
    instruction: '點擊「影音工作台」，開始一次完整的編碼決策。',
    completion: { type: 'click' },
    placement: 'right',
  },
  {
    id: 'choose-source',
    target: '[data-tour="choose-source"]',
    title: '從可播放素材開始',
    instruction: '預設影片已由後端備妥。點擊「使用這支示範影片」直接開始，也可以換成自己的影片。',
    completion: { type: 'click' },
    placement: 'right',
  },
  {
    id: 'adjust-quality',
    target: '[data-tour="adjust-crf"]',
    title: '設定畫質目標',
    instruction: '拖曳 CRF。數字越低，畫質與檔案通常越大。',
    completion: { type: 'input' },
    placement: 'right',
  },
  {
    id: 'choose-preset',
    target: '[data-tour="choose-preset"]',
    title: '決定編碼成本',
    instruction: '選擇另一個編碼速度，觀察速度與壓縮效率的取捨。',
    completion: { type: 'input' },
    placement: 'left',
  },
  {
    id: 'toggle-faststart',
    target: '[data-tour="toggle-faststart"]',
    title: '改善啟播速度',
    instruction: '切換 MP4 Faststart，讓 moov metadata 移到檔案前方。',
    completion: { type: 'input' },
    placement: 'right',
  },
  {
    id: 'submit-render',
    target: '[data-tour="submit-render"]',
    title: '送出真實算圖任務',
    instruction: '點擊「套用參數並執行 FFmpeg」。後端會實際轉碼並建立 MP4。',
    completion: { type: 'click' },
    placement: 'top',
  },
  {
    id: 'render-result',
    target: '[data-tour="render-result"]',
    title: '等待後端處理完成',
    instruction: '等待 worker 完成；成功後上方會直接播放本次產生的真實 MP4。',
    completion: {
      type: 'state',
      name: 'media-lab:render-state',
      matches: (detail) => detail === 'ready',
      rejects: (detail) => detail === 'failed' || detail === 'unavailable',
    },
    placement: 'left',
  },
  {
    id: 'open-composition',
    target: '[data-tour="tab-composition"]',
    title: '前往媒體合成',
    instruction: '點擊「媒體合成」，查看字幕、精靈圖與圖層如何共用同一條媒體時間軸。',
    completion: { type: 'click' },
    placement: 'right',
  },
  {
    id: 'inspect-composition',
    target: '[data-tour="composition-content"]',
    title: '辨識預覽與正式成品的邊界',
    instruction: '這裡用確定性時鐘示範合成預覽；正式成品仍由後端 FFmpeg 產生。點擊合成舞台繼續。',
    completion: { type: 'click' },
    placement: 'left',
  },
  {
    id: 'open-cost',
    target: '[data-tour="tab-cost"]',
    title: '前往人工智慧成本',
    instruction: '點擊「人工智慧成本」，查看用量如何歸因到專案與預算。',
    completion: { type: 'click' },
    placement: 'right',
  },
  {
    id: 'inspect-cost',
    target: '[data-tour="cost-content"]',
    title: '看懂成本治理資料流',
    instruction:
      '供應商收據會標準化成用量事件，再進行成本歸因與預算控制；目前數字清楚標示為範例。點擊內容繼續。',
    completion: { type: 'click' },
    placement: 'left',
  },
  {
    id: 'open-operations',
    target: '[data-tour="tab-operations"]',
    title: '前往維運證據',
    instruction: '點擊「維運證據」，查看任務如何被追蹤、復原與驗證。',
    completion: { type: 'click' },
    placement: 'right',
  },
  {
    id: 'inspect-operations',
    target: '[data-tour="operations-content"]',
    title: '從指令一路追到成品',
    instruction: 'Trace、Job、狀態序列、Artifact 雜湊與成本歸因可串成同一條證據鏈。點擊內容繼續。',
    completion: { type: 'click' },
    placement: 'left',
  },
  {
    id: 'open-architecture',
    target: '[data-tour="tab-architecture"]',
    title: '前往系統架構',
    instruction: '點擊「系統架構」，最後檢視前端、API、Worker 與 Artifact 的責任邊界。',
    completion: { type: 'click' },
    placement: 'right',
  },
  {
    id: 'inspect-architecture',
    target: '[data-tour="architecture-content"]',
    title: '完成整套作品導覽',
    instruction:
      '產品介面送出合約，NestJS 管理工作流，FFmpeg Worker 產生 Artifact，靜態服務負責播放。點擊架構圖完成導覽。',
    completion: { type: 'click' },
    placement: 'left',
  },
];

export function moveTourStep(current: number, direction: -1 | 1) {
  return Math.min(Math.max(current + direction, 0), interviewTourSteps.length - 1);
}
