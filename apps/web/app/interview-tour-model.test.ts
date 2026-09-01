import { describe, expect, it } from 'vitest';
import { interviewTourSteps, moveTourStep } from './interview-tour-model';

describe('guided product tour', () => {
  it('binds every step to a real data-tour target and a completion condition', () => {
    expect(interviewTourSteps).toHaveLength(6);
    for (const step of interviewTourSteps) {
      expect(step.target).toMatch(/^\[data-tour="[a-z-]+"\]$/);
      expect(step.completion.type).toBeTruthy();
    }
  });

  it('covers click, input and application-state completion', () => {
    expect(interviewTourSteps.map((step) => step.completion.type)).toEqual([
      'click',
      'input',
      'input',
      'input',
      'click',
      'state',
    ]);
  });

  it('does not move outside the tour', () => {
    expect(moveTourStep(0, -1)).toBe(0);
    expect(moveTourStep(interviewTourSteps.length - 1, 1)).toBe(interviewTourSteps.length - 1);
  });
});
