'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { interviewTourSteps, type InterviewTourStep } from './interview-tour-model';

type Rect = { top: number; left: number; right: number; bottom: number; width: number; height: number };
type TooltipPosition = { top: number; left: number; arrow: InterviewTourStep['placement'] };

const TOUR_SESSION_KEY = 'media-runtime-guided-tour-v3';
const TARGET_PADDING = 8;
const VIEWPORT_GAP = 16;
const TOOLTIP_WIDTH = 320;

function readRect(element: HTMLElement): Rect {
  const rect = element.getBoundingClientRect();
  const left = Math.max(rect.left - TARGET_PADDING, VIEWPORT_GAP / 2);
  const top = Math.max(rect.top - TARGET_PADDING, VIEWPORT_GAP / 2);
  const right = Math.min(rect.right + TARGET_PADDING, window.innerWidth - VIEWPORT_GAP / 2);
  const bottom = Math.min(rect.bottom + TARGET_PADDING, window.innerHeight - VIEWPORT_GAP / 2);
  return { top, left, right, bottom, width: right - left, height: bottom - top };
}

function positionTooltip(rect: Rect, preferred: InterviewTourStep['placement']): TooltipPosition {
  const width = Math.min(TOOLTIP_WIDTH, window.innerWidth - VIEWPORT_GAP * 2);
  const gap = 18;
  const placement =
    preferred === 'left' && rect.left < width + gap
      ? 'bottom'
      : preferred === 'right' && window.innerWidth - rect.right < width + gap
        ? 'bottom'
        : preferred;
  const unclampedLeft =
    placement === 'left'
      ? rect.left - width - gap
      : placement === 'right'
        ? rect.right + gap
        : rect.left + rect.width / 2 - width / 2;
  const left = Math.min(Math.max(unclampedLeft, VIEWPORT_GAP), window.innerWidth - width - VIEWPORT_GAP);
  const top =
    placement === 'top'
      ? Math.max(VIEWPORT_GAP, rect.top - 176)
      : placement === 'left' || placement === 'right'
        ? Math.min(Math.max(rect.top, VIEWPORT_GAP), window.innerHeight - 210)
        : Math.min(rect.bottom + gap, window.innerHeight - 210);
  return { top, left, arrow: placement ?? 'bottom' };
}

export function InterviewTour() {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [tooltip, setTooltip] = useState<TooltipPosition | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const launchButton = useRef<HTMLButtonElement>(null);
  const step = interviewTourSteps[stepIndex]!;

  const finish = useCallback(() => {
    setOpen(false);
    setRect(null);
    window.sessionStorage.setItem(TOUR_SESSION_KEY, '1');
    requestAnimationFrame(() => launchButton.current?.focus());
  }, []);

  const advance = useCallback(() => {
    setFeedback(null);
    setStepIndex((current) => {
      if (current >= interviewTourSteps.length - 1) {
        window.setTimeout(finish, 900);
        return current;
      }
      return current + 1;
    });
  }, [finish]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('guide') === '0') return;
    const requested = params.get('guide') === '1';
    if (!requested && window.sessionStorage.getItem(TOUR_SESSION_KEY) === '1') return;
    const requestedStep = Number(params.get('step')) - 1;
    const initialStep = Number.isInteger(requestedStep)
      ? Math.min(Math.max(requestedStep, 0), interviewTourSteps.length - 1)
      : 0;
    const timer = window.setTimeout(() => {
      setStepIndex(initialStep);
      setOpen(true);
    }, 500);
    return () => window.clearTimeout(timer);
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
    let target: HTMLElement | null = null;
    let frame = 0;
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
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      const focusTarget = target.matches('button, input, select, textarea, a[href]')
        ? target
        : target.querySelector<HTMLElement>('button, input, select, textarea, a[href]');
      window.setTimeout(() => focusTarget?.focus({ preventScroll: true }), 250);
      update();
      return true;
    };
    if (!attach()) {
      setRect(null);
      setTooltip(null);
    }
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
  }, [advance, open, step]);

  const spotlightStyle = rect
    ? ({ top: rect.top, left: rect.left, width: rect.width, height: rect.height } satisfies CSSProperties)
    : undefined;

  return (
    <>
      <button className="tour-launch" type="button" ref={launchButton} onClick={() => { setStepIndex(0); setOpen(true); }}>
        <span>第一次使用？</span>
        <strong>開始互動操作導覽 →</strong>
        <small>直接操作真實介面，約 2 分鐘完成</small>
      </button>
      {open ? (
        <div className="tour-layer" aria-live="polite">
          {rect ? (
            <>
              <div className="tour-blocker tour-blocker-top" style={{ height: rect.top }} />
              <div className="tour-blocker tour-blocker-left" style={{ top: rect.top, width: rect.left, height: rect.height }} />
              <div className="tour-blocker tour-blocker-right" style={{ top: rect.top, left: rect.right, height: rect.height }} />
              <div className="tour-blocker tour-blocker-bottom" style={{ top: rect.bottom }} />
              <div className="tour-spotlight" aria-hidden="true" style={spotlightStyle} />
            </>
          ) : (
            <div className="tour-blocker tour-blocker-full" />
          )}
          {tooltip ? (
            <aside className="tour-tooltip" data-placement={tooltip.arrow} style={{ top: tooltip.top, left: tooltip.left }} aria-label={`操作導覽，第 ${stepIndex + 1} 步，共 ${interviewTourSteps.length} 步`}>
              <div className="tour-tooltip-meta">
                <span>{stepIndex + 1} / {interviewTourSteps.length}</span>
                <button type="button" onClick={finish} aria-label="跳過操作導覽">跳過導覽</button>
              </div>
              <div className="tour-progress-track" aria-hidden="true">
                <span style={{ width: `${((stepIndex + 1) / interviewTourSteps.length) * 100}%` }} />
              </div>
              <strong>{step.title}</strong>
              <p>{step.instruction}</p>
              <small className={feedback ? 'tour-feedback' : undefined}>
                {feedback ?? '請直接操作發亮區域，完成後會自動前往下一步。'}
              </small>
            </aside>
          ) : (
            <p className="tour-locating">正在尋找下一個操作元件…</p>
          )}
        </div>
      ) : null}
    </>
  );
}
