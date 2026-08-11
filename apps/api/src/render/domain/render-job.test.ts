import { describe,expect,it } from 'vitest';
import { RenderJobAggregate } from './render-job';
const base={id:'job-1',projectId:'project-1',status:'accepted' as const,progress:4,stage:'accepted',estimatedCostUsd:0.1,tokens:10,artifactUrl:null,updatedAt:new Date(0).toISOString()};
describe('render state machine',()=>{ it('accepts the declared progression',()=>expect(new RenderJobAggregate(base).advance('composing',25,'compose').status).toBe('composing')); it('rejects skipped stages',()=>expect(()=>new RenderJobAggregate(base).advance('ready',100,'ready')).toThrow('INVALID_TRANSITION')); });
