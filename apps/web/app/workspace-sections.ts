export const workspaceSections = [
  'overview',
  'render',
  'composition',
  'hamster',
  'cost',
  'operations',
  'architecture',
] as const;

export type WorkspaceSection = (typeof workspaceSections)[number];

export function isWorkspaceSection(value: string): value is WorkspaceSection {
  return workspaceSections.includes(value as WorkspaceSection);
}
