'use client';

import { useEffect, useRef, useState } from 'react';
import type { RenderJob } from '@media-lab/contracts';
import { createRenderJob, getRenderJob, renderJobEvents } from '../api/render-jobs';

export function useRenderJob() {
  const [job,setJob]=useState<RenderJob|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);const stream=useRef<EventSource|null>(null);
  useEffect(()=>()=>stream.current?.close(),[]);
  function connect(id:string,after:number){const events=renderJobEvents(id,after);stream.current=events;events.addEventListener('render.progress',event=>{const next=JSON.parse((event as MessageEvent).data) as RenderJob;setJob(next);if(next.status==='ready'||next.status==='failed')events.close();});events.onerror=async()=>{events.close();try{const recovered=await getRenderJob(id);setJob(recovered);if(recovered.status!=='ready'&&recovered.status!=='failed')connect(id,recovered.sequence);}catch{setError('Live progress interrupted; authoritative state could not be recovered.');}};}
  async function run(){setBusy(true);setError(null);stream.current?.close();try{const created=await createRenderJob();setJob(created);connect(created.id,0);}catch(cause){setError(cause instanceof Error?cause.message:'Unable to create render job.');}finally{setBusy(false);}}
  return {job,busy,error,run};
}