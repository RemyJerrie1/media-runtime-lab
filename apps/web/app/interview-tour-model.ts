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
    completion: { type: 'input' },
    tab: 'render',
    placement: 'right',
  },
  {
    id: 'choose-preset',
    target: '[data-tour="choose-preset"]',
    title: '選擇編碼速度',
    instruction: '切換 Preset，比較速度與壓縮效率。',
    completion: { type: 'input' },
    tab: 'render',
    placement: 'left',
  },
  {
    id: 'toggle-faststart',
    target: '[data-tour="toggle-faststart"]',
    title: '改善啟播',
    instruction: 'Faststart 已採用推薦設定，可直接下一步。',
    completion: { type: 'input' },
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
    title: '查看處理結果',
    instruction: '完成後可直接播放 MP4，並檢查任務收據。',
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
    target: '[data-tour="composition-content"]',
    title: '預覽與成品',
    instruction: '前端負責即時預覽；後端負責確定性成品。',
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
    title: '成本治理流程',
    instruction: '收據標準化後，才能歸因成本並控制預算。',
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
    title: '追蹤完整證據鏈',
    instruction: '從指令、任務到成品雜湊，每一步都可追溯。',
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
