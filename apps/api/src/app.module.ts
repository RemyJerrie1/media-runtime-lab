import { Module } from '@nestjs/common';
import { RenderController } from './render/interfaces/render.controller';
import { RenderOrchestrator } from './render/application/render-orchestrator';
import { RenderWorker } from './render/application/render-worker';
import { OperationsTelemetry } from './render/application/operations-telemetry';
import { TenantPolicy } from './shared/tenant-policy';
import { WORKFLOW_STORE, type WorkflowStore } from './render/domain/workflow-store';
import { InMemoryWorkflowStore } from './render/infrastructure/in-memory-render.repository';
import { PostgresWorkflowStore } from './render/infrastructure/postgres-workflow.store';
import { MediaController } from './render/interfaces/media.controller';
import { MediaFilesService } from './render/infrastructure/media-files.service';
import { FfmpegMediaProcessor } from './render/infrastructure/ffmpeg-media-processor';
import { MEDIA_PROCESSOR } from './render/domain/media-processor';
import { SceneController } from './scene-render/interfaces/scene.controller';
import { SceneWorker } from './scene-render/application/scene-worker';
import { PostgresSceneStore } from './scene-render/infrastructure/postgres-scene.store';
import { ChromiumSceneProcessor } from './scene-render/infrastructure/chromium-scene.processor';
import { SCENE_STORE, SCENE_PROCESSOR } from './scene-render/domain/scene-workflow';

export async function createWorkflowStore(
  databaseUrl = process.env.DATABASE_URL,
  nodeEnv = process.env.NODE_ENV,
): Promise<WorkflowStore> {
  if (!databaseUrl && nodeEnv === 'production') {
    throw new Error('DATABASE_URL_REQUIRED_FOR_RECOVERABLE_WORKFLOW');
  }
  const store: WorkflowStore = databaseUrl
    ? new PostgresWorkflowStore(databaseUrl)
    : new InMemoryWorkflowStore();
  await store.initialize();
  return store;
}

@Module({
  controllers: [RenderController, MediaController, SceneController],
  providers: [
    SceneWorker,
    { provide: SCENE_PROCESSOR, useFactory: () => new ChromiumSceneProcessor() },
    {
      provide: SCENE_STORE,
      useFactory: async () => {
        const store = new PostgresSceneStore(process.env.DATABASE_URL);
        await store.initialize();
        return store;
      },
    },
    RenderOrchestrator,
    RenderWorker,
    OperationsTelemetry,
    TenantPolicy,
    MediaFilesService,
    FfmpegMediaProcessor,
    { provide: MEDIA_PROCESSOR, useExisting: FfmpegMediaProcessor },
    {
      provide: WORKFLOW_STORE,
      useFactory: createWorkflowStore,
    },
  ],
})
export class AppModule {}
