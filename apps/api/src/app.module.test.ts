import { describe, expect, it } from 'vitest';
import { createWorkflowStore } from './app.module';
import { InMemoryWorkflowStore } from './render/infrastructure/in-memory-render.repository';

describe('workflow store configuration', () => {
  it('allows the explicit in-memory fallback outside production', async () => {
    await expect(createWorkflowStore(undefined, 'development')).resolves.toBeInstanceOf(
      InMemoryWorkflowStore,
    );
  });

  it('refuses to advertise a recoverable production workflow without PostgreSQL', async () => {
    await expect(createWorkflowStore(undefined, 'production')).rejects.toThrow(
      'DATABASE_URL_REQUIRED_FOR_RECOVERABLE_WORKFLOW',
    );
  });
});
