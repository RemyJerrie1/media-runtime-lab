import { describe, expect, it } from 'vitest';
import { aggregateUsage, budgetUtilization, USAGE_EVENTS } from './cost-model';

describe('AI usage and cost attribution', () => {
  it('aggregates provider receipts into one ledger', () => {
    expect(aggregateUsage(USAGE_EVENTS)).toEqual({ requests: 3, tokens: 3_830, costUsd: 0.0192 });
  });

  it('supports partial ledger projection', () => {
    expect(aggregateUsage(USAGE_EVENTS.slice(0, 1))).toEqual({
      requests: 1,
      tokens: 1_160,
      costUsd: 0.0063,
    });
  });

  it('caps budget utilization at one hundred percent', () => {
    expect(budgetUtilization(0.0192)).toBe(38);
    expect(budgetUtilization(0.08)).toBe(100);
  });
});
