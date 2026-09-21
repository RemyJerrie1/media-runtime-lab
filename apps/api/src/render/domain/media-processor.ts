import type { RenderJob } from '@media-lab/contracts';
import type { ArtifactReceipt } from './workflow-store';

export const MEDIA_PROCESSOR = Symbol('MEDIA_PROCESSOR');
export interface MediaProcessor {
  render(job: RenderJob, signal?: AbortSignal): Promise<ArtifactReceipt>;
}
