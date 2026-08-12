import {describe,expect,it} from 'vitest';
import {createRenderJobSchema,renderJobSchema} from './index.js';
describe('public contracts',()=>{
  it('rejects unbounded media commands',()=>expect(createRenderJobSchema.safeParse({projectId:'x',template:'portrait',durationSeconds:999,narration:'',idempotencyKey:'x'}).success).toBe(false));
  it('keeps tenant, trace, sequence, artifact and usage evidence on every receipt',()=>expect(renderJobSchema.safeParse({id:'j1',tenantId:'tenant-1',projectId:'p1',status:'ready',progress:100,stage:'ready',sequence:5,attempt:1,traceId:'trace-1',estimatedCostUsd:.04,tokens:120,artifactUrl:'/a.mp4',artifactChecksum:'sha256:abc',updatedAt:new Date().toISOString()}).success).toBe(true));
});