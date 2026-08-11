import {describe,expect,it} from 'vitest';
import {createRenderJobSchema,renderJobSchema} from './index.js';
describe('public contracts',()=>{
  it('rejects unbounded media commands',()=>expect(createRenderJobSchema.safeParse({projectId:'x',template:'portrait',durationSeconds:999,narration:'',idempotencyKey:'x'}).success).toBe(false));
  it('keeps cost and usage on every job receipt',()=>expect(renderJobSchema.safeParse({id:'j1',projectId:'p1',status:'ready',progress:100,stage:'ready',estimatedCostUsd:.04,tokens:120,artifactUrl:'/a.mp4',updatedAt:new Date().toISOString()}).success).toBe(true));
});
