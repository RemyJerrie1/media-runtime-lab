import { describe,expect,it } from 'vitest';
import { PostgresWorkflowStore } from './postgres-workflow.store';
const databaseUrl=process.env.DATABASE_URL;
const suite=databaseUrl?describe:describe.skip;
suite('PostgreSQL workflow integration',()=>{
  it('survives repository restart, deduplicates concurrent instances, and reclaims expired work',async()=>{
    const firstStore=new PostgresWorkflowStore(databaseUrl!);const secondStore=new PostgresWorkflowStore(databaseUrl!);await firstStore.initialize();await secondStore.initialize();const key=`integration-${crypto.randomUUID()}`;const input={tenantId:'integration-tenant',traceId:'trace-integration',quotaTokens:50000,command:{projectId:'integration',template:'landscape' as const,durationSeconds:18,narration:'persistent workflow',idempotencyKey:key}};
    const [first,repeated]=await Promise.all([firstStore.create(input),secondStore.create({...input,traceId:'trace-repeated'})]);expect(first.job.id).toBe(repeated.job.id);expect([first.created,repeated.created].sort()).toEqual([false,true]);
    expect(await secondStore.findById(input.tenantId,first.job.id)).toMatchObject({id:first.job.id,status:'accepted'});
    const abandoned=await firstStore.claimNext('crashed-worker',5);expect(abandoned?.jobId).toBe(first.job.id);await new Promise(resolve=>setTimeout(resolve,15));const reclaimed=await secondStore.claimNext('recovery-worker',5000);expect(reclaimed?.jobId).toBe(first.job.id);expect(reclaimed!.attempt).toBe(2);
  });
});