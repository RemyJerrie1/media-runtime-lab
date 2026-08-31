import { Module } from '@nestjs/common';
import { RenderController } from './render/interfaces/render.controller';
import { RenderOrchestrator } from './render/application/render-orchestrator';
import { RenderWorker } from './render/application/render-worker';
import { OperationsTelemetry } from './render/application/operations-telemetry';
import { TenantPolicy } from './render/application/tenant-policy';
import { WORKFLOW_STORE, type WorkflowStore } from './render/domain/workflow-store';
import { InMemoryWorkflowStore } from './render/infrastructure/in-memory-render.repository';
import { PostgresWorkflowStore } from './render/infrastructure/postgres-workflow.store';

@Module({
  controllers: [RenderController],
  providers: [
    RenderOrchestrator,
    RenderWorker,
    OperationsTelemetry,
    TenantPolicy,
    {
      provide: WORKFLOW_STORE,
      useFactory: async (): Promise<WorkflowStore> => {
        const store: WorkflowStore = process.env.DATABASE_URL
          ? new PostgresWorkflowStore(process.env.DATABASE_URL)
          : new InMemoryWorkflowStore();
        await store.initialize();
        return store;
      },
    },
  ],
})
export class AppModule {}
