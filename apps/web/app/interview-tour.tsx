'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { interviewTourSteps, type InterviewTourStep } from './interview-tour-model';

type Rect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};
type TooltipPosition = {
  top: number;
  left: number;
  maxHeight: number;
  arrow: InterviewTourStep['placement'];
};

const TOUR_SESSION_KEY = 'media-runtime-guided-tour-v4';
const TOUR_STEP_KEY = 'media-runtime-guided-tour-step-v1';
const TARGET_PADDING = 8;
const VIEWPORT_GAP = 16;
const TOOLTIP_WIDTH = 280;
const TOOLTIP_ESTIMATED_HEIGHT = 340;
const RENDER_WAIT_STEP = interviewTourSteps.findIndex(
  (candidate) => candidate.id === 'render-result',
);
const RENDER_DEPENDENT_STEPS = new Set([
  'switch-rendition',
  'inspect-manifest',
  'inspect-vmaf-results',
]);

function readRect(element: HTMLElement): Rect {
  const rect = element.getBoundingClientRect();
  const viewportLeft = VIEWPORT_GAP / 2;
  const viewportTop = VIEWPORT_GAP / 2;
  const viewportRight = window.innerWidth - VIEWPORT_GAP / 2;
  const viewportBottom = window.innerHeight - VIEWPORT_GAP / 2;
  const left = Math.min(Math.max(rect.left - TARGET_PADDING, viewportLeft), viewportRight);
  const top = Math.min(Math.max(rect.top - TARGET_PADDING, viewportTop), viewportBottom);
  const right = Math.max(Math.min(rect.right + TARGET_PADDING, viewportRight), left);
  const bottom = Math.max(Math.min(rect.bottom + TARGET_PADDING, viewportBottom), top);
  return { top, left, right, bottom, width: right - left, height: bottom - top };
}

function positionTooltip(
  rect: Rect,
  preferred: InterviewTourStep['placement'],
  tooltipHeight = TOOLTIP_ESTIMATED_HEIGHT,
): TooltipPosition {
  const width = Math.min(TOOLTIP_WIDTH, window.innerWidth - VIEWPORT_GAP * 2);
  const gap = 18;
  const available = {
    top: rect.top - gap - VIEWPORT_GAP,
    right: window.innerWidth - rect.right - gap - VIEWPORT_GAP,
    bottom: window.innerHeight - rect.bottom - gap - VIEWPORT_GAP,
    left: rect.left - gap - VIEWPORT_GAP,
  };
  const fits = {
    top: available.top >= tooltipHeight,
    right: available.right >= width,
    bottom: available.bottom >= tooltipHeight,
    left: available.left >= width,
  };
  const order: NonNullable<InterviewTourStep['placement']>[] = [
    preferred ?? 'bottom',
    'bottom',
    'top',
    'right',
    'left',
  ];
  const uniqueOrder = order.filter((candidate, index) => order.indexOf(candidate) === index);
  const placement =
    uniqueOrder.find((candidate) => fits[candidate]) ??
    (available.right >= width
      ? 'right'
      : available.left >= width
        ? 'left'
        : available.top >= available.bottom
          ? 'top'
          : 'bottom');
  const unclampedLeft =
    placement === 'left'
      ? rect.left - width - gap
      : placement === 'right'
        ? rect.right + gap
        : rect.left + rect.width / 2 - width / 2;
  const left = Math.min(
    Math.max(unclampedLeft, VIEWPORT_GAP),
    window.innerWidth - width - VIEWPORT_GAP,
  );
  const top =
    placement === 'top'
      ? Math.max(VIEWPORT_GAP, rect.top - tooltipHeight - gap)
      : placement === 'left' || placement === 'right'
        ? Math.min(
            Math.max(rect.top + rect.height / 2 - tooltipHeight / 2, VIEWPORT_GAP),
            window.innerHeight - tooltipHeight - VIEWPORT_GAP,
          )
        : rect.bottom + gap;
  const maxHeight =
    placement === 'top'
      ? Math.max(120, rect.top - gap - VIEWPORT_GAP)
      : placement === 'bottom'
        ? Math.max(120, window.innerHeight - rect.bottom - gap - VIEWPORT_GAP)
        : window.innerHeight - VIEWPORT_GAP * 2;
  return { top, left, maxHeight, arrow: placement ?? 'bottom' };
}

export function InterviewTour() {
  const tooltipRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [tooltip, setTooltip] = useState<TooltipPosition | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const step = interviewTourSteps[stepIndex]!;

  const finish = useCallback(() => {
    setOpen(false);
    setRect(null);
    window.sessionStorage.setItem(TOUR_SESSION_KEY, '1');
    window.sessionStorage.removeItem(TOUR_STEP_KEY);
  }, []);

  const advance = useCallback(() => {
    setFeedback(null);
    setStepIndex((current) => {
      if (current >= interviewTourSteps.length - 1) {
        window.setTimeout(finish, 900);
        return current;
      }
      window.sessionStorage.setItem(TOUR_STEP_KEY, String(current + 1));
      const route =
        interviewTourSteps[current]?.id === 'open-design-system'
          ? '/design-system'
          : interviewTourSteps[current]?.id === 'open-api-reference'
            ? '/api-reference'
            : null;
      if (route) window.setTimeout(() => window.location.assign(route), 0);
      return current + 1;
    });
  }, [finish]);

  const goBack = useCallback(() => {
    setFeedback(null);
    setStepIndex((current) => {
      const previous = Math.max(current - 1, 0);
      window.sessionStorage.setItem(TOUR_STEP_KEY, String(previous));
      return previous;
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('guide') === '1';
    const savedStep = window.sessionStorage.getItem(TOUR_STEP_KEY);
    const resumedStep = Number(savedStep);
    const canResume = savedStep !== null && Number.isInteger(resumedStep) && resumedStep >= 0;
    if (!requested && !canResume) return;
    const requestedStep = Number(params.get('step')) - 1;
    const initialStep = canResume
      ? Math.min(resumedStep, interviewTourSteps.length - 1)
      : Number.isInteger(requestedStep)
        ? Math.min(Math.max(requestedStep, 0), interviewTourSteps.length - 1)
        : 0;
    const timer = window.setTimeout(() => {
      setStepIndex(initialStep);
      setOpen(true);
    }, 500);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const start = () => {
      window.sessionStorage.setItem(TOUR_STEP_KEY, '0');
      setStepIndex(0);
      setOpen(true);
    };
    window.addEventListener('media-lab:start-tour', start);
    return () => window.removeEventListener('media-lab:start-tour', start);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [finish, open]);

  useEffect(() => {
    if (!open) return;
    if (step.pathname && window.location.pathname !== step.pathname) {
      window.sessionStorage.setItem(TOUR_STEP_KEY, String(stepIndex));
      window.location.replace(step.pathname);
      return;
    }
    let target: HTMLElement | null = null;
    let frame = 0;
    let resizeObserver: ResizeObserver | undefined;
    const settleTimers: number[] = [];
    let targetFound = false;
    setRect(null);
    setTooltip(null);
    window.dispatchEvent(new CustomEvent('media-lab:select-tab', { detail: step.tab }));
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!target?.isConnected) return;
        const nextRect = readRect(target);
        setRect(nextRect);
        setTooltip(positionTooltip(nextRect, step.placement));
      });
    };
    const attach = () => {
      const found = document.querySelector(step.target);
      if (!(found instanceof HTMLElement)) return false;
      target = found;
      targetFound = true;
      target.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
      resizeObserver?.disconnect();
      resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(target);
      const focusTarget = target.matches('button, input, select, textarea, a[href]')
        ? target
        : target.querySelector<HTMLElement>('button, input, select, textarea, a[href]');
      update();
      for (const delay of [50, 150, 350]) {
        settleTimers.push(
          window.setTimeout(() => {
            target?.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
            update();
          }, delay),
        );
      }
      settleTimers.push(window.setTimeout(() => focusTarget?.focus({ preventScroll: true }), 180));
      return true;
    };
    if (!attach()) {
      setRect(null);
      setTooltip(null);
      if (step.id === 'open-design-system' || step.id === 'open-api-reference') {
        const route = step.id === 'open-design-system' ? '/design-system' : '/api-reference';
        window.sessionStorage.setItem(TOUR_STEP_KEY, String(stepIndex + 1));
        settleTimers.push(window.setTimeout(() => window.location.assign(route), 450));
      }
    }
    settleTimers.push(
      window.setTimeout(() => {
        if (targetFound) return;
        if (RENDER_DEPENDENT_STEPS.has(step.id) && RENDER_WAIT_STEP >= 0) {
          setFeedback('轉檔仍在進行，導覽已回到處理進度，完成後會自動繼續。');
          window.sessionStorage.setItem(TOUR_STEP_KEY, String(RENDER_WAIT_STEP));
          setStepIndex(RENDER_WAIT_STEP);
          return;
        }
        setFeedback('找不到導覽目標，已結束導覽並恢復頁面操作。');
        window.setTimeout(finish, 900);
      }, 3500),
    );
    const observer = new MutationObserver(() => {
      if (!target?.isConnected) attach();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const completion = step.completion;
    const onTargetEvent = (event: Event) => {
      if (!target || !target.contains(event.target as Node)) return;
      if (completion.type === 'input' && completion.validate) {
        const control = event.target;
        if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) return;
        if (!completion.validate(control)) return;
      }
      advance();
    };
    const onCustomEvent = (event: Event) => {
      if (completion.type === 'state') {
        const detail = event instanceof CustomEvent ? event.detail : undefined;
        if (completion.rejects?.(detail)) {
          if (completion.retryStep === undefined) {
            setFeedback('後端目前未完成任務；錯誤已顯示在狀態區。導覽將結束，不會卡在此處。');
            window.setTimeout(finish, 2600);
          } else {
            const retryStep = completion.retryStep;
            setFeedback('任務未完成，已帶你回到送出步驟，可以調整後重新執行。');
            window.setTimeout(() => {
              setStepIndex(retryStep);
              setFeedback(null);
            }, 1600);
          }
          return;
        }
        if (!completion.matches(detail)) return;
      }
      advance();
    };
    const eventName = completion.type === 'click' ? 'click' : 'input';
    const keepFocusInTour = (event: FocusEvent) => {
      const focused = event.target;
      if (!(focused instanceof Node) || target?.contains(focused)) return;
      if (focused instanceof HTMLElement && focused.closest('.tour-tooltip')) return;
      const focusTarget = target?.matches('button, input, select, textarea, a[href]')
        ? target
        : target?.querySelector<HTMLElement>('button, input, select, textarea, a[href]');
      focusTarget?.focus({ preventScroll: true });
    };
    if (completion.type === 'click' || completion.type === 'input') {
      document.addEventListener(eventName, onTargetEvent, true);
    } else if (completion.type === 'event' || completion.type === 'state') {
      window.addEventListener(completion.name, onCustomEvent);
    }
    const routeTimer =
      completion.type === 'route'
        ? window.setInterval(() => {
            if (window.location.pathname === completion.pathname) advance();
          }, 200)
        : undefined;
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    document.addEventListener('focusin', keepFocusInTour);
    return () => {
      observer.disconnect();
      resizeObserver?.disconnect();
      settleTimers.forEach((timer) => window.clearTimeout(timer));
      cancelAnimationFrame(frame);
      document.removeEventListener(eventName, onTargetEvent, true);
      if (completion.type === 'event' || completion.type === 'state') {
        window.removeEventListener(completion.name, onCustomEvent);
      }
      if (routeTimer) window.clearInterval(routeTimer);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      document.removeEventListener('focusin', keepFocusInTour);
    };
  }, [advance, finish, open, step, stepIndex]);

  useLayoutEffect(() => {
    const element = tooltipRef.current;
    if (!open || !rect || !element) return;
    const reposition = () => {
      const measuredHeight = Math.ceil(element.getBoundingClientRect().height);
      const next = positionTooltip(rect, step.placement, measuredHeight);
      setTooltip((current) =>
        current &&
        current.top === next.top &&
        current.left === next.left &&
        current.maxHeight === next.maxHeight &&
        current.arrow === next.arrow
          ? current
          : next,
      );
    };
    reposition();
    const observer = new ResizeObserver(reposition);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, rect, step.placement, stepIndex]);

  useLayoutEffect(() => {
    tooltipRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [stepIndex]);

  const continueTour = useCallback(() => {
    if (step.completion.type === 'click') {
      const target = document.querySelector<HTMLElement>(step.target);
      const control = target?.matches('button, a[href], input, select, textarea')
        ? target
        : target?.querySelector<HTMLElement>('button, a[href], input, select, textarea');
      if (control) {
        control.click();
        return;
      }
    }
    if (step.completion.type === 'state') {
      setFeedback('轉檔正在進行；完成後導覽會自動前往成品、HLS 與 VMAF 證據。');
      return;
    }
    advance();
  }, [advance, step]);

  const spotlightStyle = rect
    ? ({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      } satisfies CSSProperties)
    : undefined;

  return (
    <>
      {open ? (
        <div className="tour-layer" aria-live="polite">
          {rect ? (
            <>
              <div className="tour-blocker tour-blocker-top" style={{ height: rect.top }} />
              <div
                className="tour-blocker tour-blocker-left"
                style={{ top: rect.top, width: rect.left, height: rect.height }}
              />
              <div
                className="tour-blocker tour-blocker-right"
                style={{ top: rect.top, left: rect.right, height: rect.height }}
              />
              <div className="tour-blocker tour-blocker-bottom" style={{ top: rect.bottom }} />
              <div className="tour-spotlight" aria-hidden="true" style={spotlightStyle} />
            </>
          ) : (
            <div className="tour-blocker tour-blocker-full" />
          )}
          {tooltip ? (
            <aside
              ref={tooltipRef}
              className="tour-tooltip"
              data-placement={tooltip.arrow}
              style={{ top: tooltip.top, left: tooltip.left, maxHeight: tooltip.maxHeight }}
              role="region"
              aria-labelledby="tour-step-title"
              aria-describedby="tour-step-instruction tour-keyboard-help"
            >
              <div className="tour-tooltip-meta">
                <span>
                  {stepIndex + 1} / {interviewTourSteps.length}
                </span>
                <button type="button" onClick={finish} aria-label="跳過操作導覽">
                  跳過導覽
                </button>
              </div>
              <div className="tour-progress-track" aria-hidden="true">
                <span
                  style={{ width: `${((stepIndex + 1) / interviewTourSteps.length) * 100}%` }}
                />
              </div>
              <strong id="tour-step-title">{step.title}</strong>
              <p id="tour-step-instruction">{step.instruction}</p>
              <small id="tour-keyboard-help" className="visually-hidden">
                第 {stepIndex + 1} 步，共 {interviewTourSteps.length} 步。按 Escape 可以結束導覽。
              </small>
              {feedback ? <small className="tour-feedback">{feedback}</small> : null}
              <div className="tour-navigation">
                <button type="button" onClick={goBack} disabled={stepIndex === 0}>
                  ← 上一步
                </button>
                <button
                  type="button"
                  onClick={continueTour}
                  disabled={step.completion.type === 'state'}
                  aria-describedby={
                    step.completion.type === 'state' ? 'tour-step-instruction' : undefined
                  }
                >
                  {step.completion.type === 'state'
                    ? '處理中，請稍候…'
                    : stepIndex === interviewTourSteps.length - 1
                      ? '完成導覽'
                      : '繼續導覽 →'}
                </button>
              </div>
            </aside>
          ) : (
            <div className="tour-locating" role="status">
              <p>{feedback ?? '正在前往下一個導覽位置…'}</p>
              <button type="button" onClick={finish}>
                結束導覽
              </button>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
