export type TourTabId =
  | 'overview'
  | 'render'
  | 'composition'
  | 'cost'
  | 'operations'
  | 'architecture';

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
    id: 'open-workbench',
    target: '[data-tour="open-workbench"]',
    title: '先進入影音工作台',
    instruction: '點擊「影音工作台」，開始一次完整的編碼決策。',
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
    instruction: '點擊「套用並算圖」。系統會將目前參數送往後端。',
    completion: { type: 'click' },
    placement: 'top',
  },
  {
    id: 'render-result',
    target: '[data-tour="render-result"]',
    title: '等待後端處理完成',
    instruction: '這裡會即時呈現任務狀態、進度與成本；API 成功後自動完成導覽。',
    completion: {
      type: 'state',
      name: 'media-lab:render-state',
      matches: (detail) => detail === 'ready',
      rejects: (detail) => detail === 'failed' || detail === 'unavailable',
    },
    placement: 'left',
  },
];

export function moveTourStep(current: number, direction: -1 | 1) {
  return Math.min(Math.max(current + direction, 0), interviewTourSteps.length - 1);
}
