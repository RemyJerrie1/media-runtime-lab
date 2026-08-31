import { describe, expect, it } from 'vitest';
import { interviewTourSteps, moveTourStep } from './interview-tour-model';

describe('interview tour', () => {
  it('covers the positioning, workflow, recovery, architecture and media evidence', () => {
    expect(interviewTourSteps.map((step) => step.tab)).toEqual([
      'overview',
      'composition',
      'render',
      'operations',
      'architecture',
    ]);
  });

  it('does not move outside the tour', () => {
    expect(moveTourStep(0, -1)).toBe(0);
    expect(moveTourStep(interviewTourSteps.length - 1, 1)).toBe(interviewTourSteps.length - 1);
  });
});
