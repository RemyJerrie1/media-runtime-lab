import { describe, expect, it } from 'vitest';
import { PostgresWorkflowStore } from './postgres-workflow.store';
const databaseUrl = process.env.DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
suite('PostgreSQL workflow integration', () => {
  it('survives repository restart, deduplicates concurrent instances, and reclaims expired work', async () => {
    const firstStore = new PostgresWorkflowStore(databaseUrl!);
    const secondStore = new PostgresWorkflowStore(databaseUrl!);
    await firstStore.initialize();
    await secondStore.initialize();
    const key = `integration-${crypto.randomUUID()}`;
    const input = {
      tenantId: 'integration-tenant',
      traceId: 'trace-integration',
      quotaTokens: 50000,
      command: {
        projectId: 'integration',
        template: 'landscape' as const,
        trimStartSeconds: 0,
        durationSeconds: 18,
        encoding: {
          codec: 'libx264' as const,
          preset: 'medium' as const,
          rateControl: 'crf' as const,
          crf: 23,
          bitrateKbps: 4000,
          gop: 60,
          fps: 30,
        },
        processing: {
          frameRateMode: 'cfr' as const,
          audioSampleRate: 48000 as const,
          audioSync: 'async-resample' as const,
          subtitleMode: 'webvtt' as const,
          watermarkMode: 'visible' as const,
          adInsertion: 'none' as const,
          fastStart: true,
        },
        narration: 'persistent workflow',
        idempotencyKey: key,
      },
    };
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        (index % 2 === 0 ? firstStore : secondStore).create({
          ...input,
          traceId: `trace-${index}`,
        }),
      ),
    );
    expect(new Set(results.map((result) => result.job.id)).size).toBe(1);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    const first = results[0]!;
    expect(await secondStore.findById(input.tenantId, first.job.id)).toMatchObject({
      id: first.job.id,
      status: 'accepted',
    });
    const abandoned = await firstStore.claimNext('crashed-worker', 5);
    expect(abandoned?.jobId).toBe(first.job.id);
    await new Promise((resolve) => setTimeout(resolve, 15));
    const reclaimed = await secondStore.claimNext('recovery-worker', 5000);
    expect(reclaimed?.jobId).toBe(first.job.id);
    expect(reclaimed!.attempt).toBe(2);
  });
});
