import {
  Inject,
  Injectable,
  type OnModuleInit,
  type OnApplicationShutdown,
  Logger,
} from '@nestjs/common';
import {
  SCENE_STORE,
  SCENE_PROCESSOR,
  type SceneStore,
  type SceneProcessor,
} from '../domain/scene-workflow';
import type { SceneReceipt } from '@media-lab/contracts';

@Injectable()
export class SceneWorker implements OnModuleInit, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;
  private pending: Promise<boolean> | undefined;
  private controller: AbortController | undefined;
  private readonly owner = crypto.randomUUID();
  private readonly logger = new Logger(SceneWorker.name);
  constructor(
    @Inject(SCENE_STORE) private store: SceneStore,
    @Inject(SCENE_PROCESSOR) private processor: SceneProcessor,
  ) {}
  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_RENDER_WORKER === 'true') return;
    this.timer = setInterval(() => {
      if (!this.pending)
        this.pending = this.processNext()
          .catch((error) => {
            this.logger.error(String(error));
            return false;
          })
          .finally(() => {
            this.pending = undefined;
          });
    }, 250);
  }
  async onApplicationShutdown() {
    clearInterval(this.timer);
    this.controller?.abort(new Error('SCENE_WORKER_STOPPED'));
    await this.pending;
  }
  async processNext() {
    const work = await this.store.claim(this.owner, 10000);
    if (!work) return false;
    const controller = new AbortController();
    this.controller = controller;
    let renewal: Promise<void> | undefined;
    let receipt: SceneReceipt | undefined;
    let published = false;
    const timer = setInterval(() => {
      if (renewal || controller.signal.aborted) return;
      renewal = this.store
        .renew(work, 10000)
        .then((owned) => {
          if (!owned) controller.abort(new Error('SCENE_LEASE_LOST'));
        })
        .catch(() => controller.abort(new Error('SCENE_LEASE_LOST')))
        .finally(() => {
          renewal = undefined;
        });
    }, 1000);
    try {
      if (work.job.attempt > work.retryLimit) throw new Error('SCENE_ATTEMPTS_EXHAUSTED');
      receipt = await this.processor.render(
        work.job,
        controller.signal,
        async (frames, encoding) => {
          controller.signal.throwIfAborted();
          if (
            !(await this.store.update(work, {
              status: encoding ? 'encoding' : 'rendering',
              frames,
            }))
          ) {
            controller.abort(new Error('SCENE_LEASE_LOST'));
            controller.signal.throwIfAborted();
          }
        },
      );
      controller.signal.throwIfAborted();
      published = await this.store.update(work, { status: 'ready', frames: 120, receipt });
      return published;
    } catch (error) {
      if (!controller.signal.aborted) {
        const current = await this.store.get(work.tenant, work.job.id);
        await this.store.update(work, {
          status: 'failed',
          frames: current?.completedFrames ?? 0,
          error: error instanceof Error ? error.message.slice(0, 200) : 'SCENE_RENDER_FAILED',
        });
      }
      return false;
    } finally {
      clearInterval(timer);
      await renewal;
      if (receipt && !published) {
        // A COMMIT acknowledgement may be lost. Never remove a possibly published receipt.
        try {
          const current = await this.store.get(work.tenant, work.job.id);
          if (current?.receipt?.artifactUrl !== receipt.artifactUrl)
            await this.processor.discard(receipt);
        } catch {
          /* Keep the immutable file when ownership cannot be determined. */
        }
      }
      this.controller = undefined;
    }
  }
}
