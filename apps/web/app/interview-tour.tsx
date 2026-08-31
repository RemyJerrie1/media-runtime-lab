'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './design-system/button';
import { interviewTourSteps, moveTourStep, type TourTabId } from './interview-tour-model';

type InterviewTourProps = {
  onSelectTab: (tab: TourTabId) => void;
};

type SpotlightRect = { top: number; left: number; width: number; height: number };

export function InterviewTour({ onSelectTab }: InterviewTourProps) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const launchButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const step = interviewTourSteps[stepIndex]!;

  const selectStep = (nextIndex: number) => {
    setStepIndex(nextIndex);
    onSelectTab(interviewTourSteps[nextIndex]!.tab);
  };
  const start = () => {
    setOpen(true);
    selectStep(0);
  };
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => launchButton.current?.focus());
  };

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('guide') === '1') start();
  }, []);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowLeft') selectStep(moveTourStep(stepIndex, -1));
      if (event.key === 'ArrowRight') selectStep(moveTourStep(stepIndex, 1));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, stepIndex]);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const updateSpotlight = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const target = document.querySelector(step.target);
        if (!(target instanceof HTMLElement)) return;
        const rect = target.getBoundingClientRect();
        const padding = 8;
        setSpotlight({
          top: Math.max(rect.top - padding, 8),
          left: Math.max(rect.left - padding, 8),
          width: Math.min(rect.width + padding * 2, window.innerWidth - 16),
          height: Math.min(rect.height + padding * 2, window.innerHeight - 16),
        });
      });
    };
    const target = document.querySelector(step.target);
    if (target instanceof HTMLElement)
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const settleTimer = setTimeout(updateSpotlight, 350);
    updateSpotlight();
    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight, true);
    return () => {
      clearTimeout(settleTimer);
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight, true);
    };
  }, [open, step.target]);

  return (
    <>
      <button className="tour-launch" type="button" ref={launchButton} onClick={start}>
        <span>作品導覽</span>
        <strong>用 5 分鐘看懂這個作品 →</strong>
      </button>
      {open ? (
        <div className="tour-layer">
          {spotlight ? (
            <div
              className="tour-spotlight"
              aria-hidden="true"
              style={{
                top: spotlight.top,
                left: spotlight.left,
                width: spotlight.width,
                height: spotlight.height,
              }}
            />
          ) : null}
          <aside
            className="tour-card"
            role="dialog"
            aria-labelledby="tour-title"
            aria-describedby="tour-script"
          >
            <div className="tour-card-topline">
              <span>{step.eyebrow}</span>
              <button ref={closeButton} type="button" onClick={close} aria-label="關閉作品導覽">
                ×
              </button>
            </div>
            <h2 id="tour-title">{step.title}</h2>
            <p className="tour-action">現在操作：{step.action}</p>
            <p className="tour-hint">發亮區域可以直接操作</p>
            <div className="tour-script" id="tour-script">
              <span>設計重點</span>
              <p>「{step.script}」</p>
            </div>
            <div
              className="tour-progress"
              aria-label={`導覽進度 ${stepIndex + 1} / ${interviewTourSteps.length}`}
            >
              {interviewTourSteps.map((item, index) => (
                <button
                  key={item.eyebrow}
                  type="button"
                  aria-label={`前往第 ${index + 1} 步`}
                  aria-current={index === stepIndex ? 'step' : undefined}
                  onClick={() => selectStep(index)}
                />
              ))}
            </div>
            <div className="tour-actions">
              <Button
                variant="secondary"
                size="small"
                disabled={stepIndex === 0}
                onClick={() => selectStep(moveTourStep(stepIndex, -1))}
              >
                上一步
              </Button>
              {stepIndex === interviewTourSteps.length - 1 ? (
                <Button size="small" onClick={close}>
                  完成導覽
                </Button>
              ) : (
                <Button size="small" onClick={() => selectStep(moveTourStep(stepIndex, 1))}>
                  下一步
                </Button>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
