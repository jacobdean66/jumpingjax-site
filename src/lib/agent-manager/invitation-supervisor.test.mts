import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assessInvitationOperation, InvitationSupervisorWorker, INVITATION_SUPERVISION_JOB_TYPE } from './invitation-supervisor.ts';
import { configuredDeterministicWorkers, selectWorker } from './worker.ts';
import type { AgentJob } from './types';

const operationId='11111111-1111-4111-8111-111111111111';
const imageId='a'.repeat(64);
const event=(name:string, metadata:Record<string,unknown>={})=>({event_type:`invitation.${name}`,metadata,created_at:new Date(0).toISOString()});
const job=(stage='composition')=>({agent_id:'party',job_type:INVITATION_SUPERVISION_JOB_TYPE,payload:{operationId,stage,startedAt:new Date(0).toISOString()}} as AgentJob);
const deps=(events=[event('invitation_composed',{image_id:imageId})])=>({events:async()=>events,artwork:async()=>true,booking:async()=>true});

test('worker is connected to the existing dispatcher and never invokes a model',()=>{
  const worker=selectWorker(job(),configuredDeterministicWorkers());assert.ok(worker instanceof InvitationSupervisorWorker);assert.equal(worker.kind,'deterministic');
});
test('search completion and clarification wait for the owner, not booking completion',()=>{
  assert.equal(assessInvitationOperation('search',[event('candidates_found',{candidate_count:2})],new Date(0).toISOString(),100).state,'ready');
  assert.equal(assessInvitationOperation('search',[event('clarification_required')],new Date(0).toISOString(),100).state,'ready');
  assert.equal(assessInvitationOperation('search',[event('candidates_found',{candidate_count:0})],new Date(0).toISOString(),180000).state,'failed');
});
test('worker completion cannot skip confirmation, timeout or explicit failures',()=>{
  assert.equal(assessInvitationOperation('confirmation',[event('invitation_composed',{image_id:imageId})],new Date(0).toISOString(),100).state,'waiting');
  assert.equal(assessInvitationOperation('confirmation',[event('confirmation_saved',{image_id:'b'.repeat(64)}),event('invitation_composed',{image_id:imageId})],new Date(0).toISOString(),180000).state,'failed');
  assert.equal(assessInvitationOperation('composition',[event('invitation_composed',{image_id:imageId}),event('failed',{category:'workflow_failed'})],new Date(0).toISOString(),100).state,'failed');
  assert.equal(assessInvitationOperation('composition',[],new Date(0).toISOString(),180000).state,'failed');
});
test('supervisor rejects an apparently finished result if stored artwork fails verification',async()=>{
  const worker=new InvitationSupervisorWorker({...deps(),artwork:async()=>false},()=>100);
  const result=await worker.execute(job(),new AbortController().signal);assert.equal(result.ok,false);assert.match(result.summary,/rejected/);
});
test('approved composition is only a stage success; booking requires independent row verification',async()=>{
  const composed=await new InvitationSupervisorWorker(deps(),()=>100).execute(job(),new AbortController().signal);assert.equal(composed.ok,true);assert.match(composed.summary,/awaiting booking/);
  const booking=job('booking');let checked=0;
  const checks={...deps([event('booking_verified',{image_id:imageId})]),booking:async()=>{checked++;return false;}};
  const rejected=await new InvitationSupervisorWorker(checks,()=>100).execute(booking,new AbortController().signal);assert.equal(rejected.ok,false);assert.equal(checked,1);
  const accepted=await new InvitationSupervisorWorker({...checks,booking:async()=>true},()=>100).execute(booking,new AbortController().signal);assert.equal(accepted.ok,true);assert.match(accepted.summary,/independently verified/);
});
test('only evidence reads retry; invalid payload, cancellation and timeout do not',async()=>{
  const signal=new AbortController();signal.abort();assert.equal((await new InvitationSupervisorWorker(deps()).execute(job(),signal.signal)).ok,false);
  const invalid=await new InvitationSupervisorWorker(deps()).execute({...job(),payload:{}},new AbortController().signal);assert.deepEqual(invalid,{ok:false,transient:false,summary:'Invalid invitation supervision payload.'});
  const waiting=await new InvitationSupervisorWorker(deps([]),()=>100).execute(job(),new AbortController().signal);assert.equal(waiting.ok,false);if(!waiting.ok)assert.equal(waiting.transient,true);
  const timed=await new InvitationSupervisorWorker(deps([]),()=>180000).execute(job(),new AbortController().signal);assert.equal(timed.ok,false);if(!timed.ok)assert.equal(timed.transient,false);
  const unavailable=await new InvitationSupervisorWorker({...deps(),events:async()=>{throw Error('private provider response');}},()=>100).execute(job(),new AbortController().signal);assert.equal(unavailable.ok,false);assert.ok(!unavailable.summary.includes('private provider'));
});

test('default worker independently reads approved stored pixels and booking; no provider generation',async context=>{
  const names=['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];const saved=names.map(n=>process.env[n]);
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://invitation-supervisor-test.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';
  context.after(()=>names.forEach((n,i)=>{if(saved[i]===undefined)delete process.env[n];else process.env[n]=saved[i];}));
  const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.from('offline supervision fixture')]);
  const hash=createHash('sha256').update(png).digest('hex');let corrupt=false,mismatch=false,reads=0;
  const bookingId='22222222-2222-4222-8222-222222222222';
  context.mock.method(globalThis,'fetch',async(source:string|Request,init?:RequestInit)=>{
    const request=new Request(source,init),url=new URL(request.url);assert.equal(url.hostname,'invitation-supervisor-test.supabase.co');assert.equal(request.method,'GET');reads++;
    if(url.pathname==='/rest/v1/agent_events'){assert.ok(url.searchParams.get('metadata')?.includes(operationId));return Response.json([event('booking_verified',{image_id:hash})]);}
    if(url.pathname==='/rest/v1/invitation_theme_assets'){assert.equal(url.searchParams.get('approval_status'),'eq.approved');return Response.json([{id:'approved'}]);}
    if(url.pathname.includes('/storage/v1/object/'))return new Response(corrupt?Buffer.from('bad image'):png);
    if(url.pathname==='/rest/v1/facility_bookings'){assert.equal(url.searchParams.get('id'),`eq.${bookingId}`);assert.equal(url.searchParams.get('select'),'invitation');return Response.json({invitation:{confirmedTheme:{id:'legacy-theme-id',imagePath:`/api/facility/invitations/artwork/${hash}`},optionIndex:mismatch?1:2}});}
    throw Error('Unexpected supervision dependency');
  });
  const input={...job('booking'),payload:{...job('booking').payload,bookingId,themeId:'legacy-theme-id',optionIndex:2}};
  const worker=new InvitationSupervisorWorker(undefined,()=>100);
  assert.equal((await worker.execute(input,new AbortController().signal)).ok,true);assert.equal(reads,4);
  corrupt=true;assert.equal((await worker.execute(input,new AbortController().signal)).ok,false);
  corrupt=false;mismatch=true;assert.equal((await worker.execute(input,new AbortController().signal)).ok,false);
});
