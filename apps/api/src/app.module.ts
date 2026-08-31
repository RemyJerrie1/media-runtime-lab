import { Module } from '@nestjs/common';
import { RenderController } from './render/interfaces/render.controller';
import { RenderOrchestrator } from './render/application/render-orchestrator';
import { RenderWorker } from './render/application/render-worker';
import { OperationsTelemetry } from './render/application/operations-telemetry';
import { TenantPolicy } from './render/application/tenant-policy';
import { WORKFLOW_STORE, type WorkflowStore } from './render/domain/workflow-store';
import { InMemoryWorkflowStore } from './render/infrastructure/in-memory-render.repository';
import { PostgresWorkflowStore } from './render/infrastructure/postgres-workflow.store';

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
  controllers: [RenderController],
  providers: [
    RenderOrchestrator,
    RenderWorker,
    OperationsTelemetry,
    TenantPolicy,
    {
      provide: WORKFLOW_STORE,
      useFactory: createWorkflowStore,
    },
  ],
})
export class AppModule {}
