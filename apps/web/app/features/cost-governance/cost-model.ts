export type UsageEvent = {
  id: string;
  provider: string;
  model: string;
  workspace: string;
  project: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
};

export const USAGE_EVENTS: readonly UsageEvent[] = [
  { id:'evt_0181', provider:'OpenAI', model:'GPT-4.1 mini', workspace:'Studio', project:'Launch Reel', promptTokens:920, completionTokens:240, costUsd:.0063 },
  { id:'evt_0182', provider:'Google', model:'Gemini 2.5 Flash', workspace:'Studio', project:'Launch Reel', promptTokens:1_400, completionTokens:180, costUsd:.0041 },
  { id:'evt_0183', provider:'Anthropic', model:'Claude Haiku', workspace:'Growth', project:'Social Cut', promptTokens:760, completionTokens:330, costUsd:.0088 },
] as const;

export function aggregateUsage(events: readonly UsageEvent[]) {
  return events.reduce((total, event) => ({
    requests: total.requests + 1,
    tokens: total.tokens + event.promptTokens + event.completionTokens,
    costUsd: Number((total.costUsd + event.costUsd).toFixed(4)),
  }), { requests: 0, tokens: 0, costUsd: 0 });
}

export function budgetUtilization(costUsd: number, budgetUsd = .05) {
  return Math.min(100, Math.round(costUsd / budgetUsd * 100));
}
