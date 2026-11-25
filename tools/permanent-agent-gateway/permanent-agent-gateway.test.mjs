import test from 'node:test';
import assert from 'node:assert/strict';
import {createGateway} from './permanent-agent-gateway.mjs';
const token='synthetic_'+ 'a'.repeat(48),owner='b'.repeat(64);
test('gateway exposes only fixed API paths, authenticated owner scope and safe upstream responses',async()=>{
 const calls=[];let body={answer:{text:'Saved backend answer'}};
 const server=createGateway({token,fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json(body);}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const headers={authorization:'Bearer '+token,'x-jumping-jax-owner':owner,'content-type':'application/json'};
 try{
  for(const path of ['/','/api/internal/jumping-jax/tasks','/api/internal/jumping-jax/ask?x=1','/api/internal/jumping-jax/%61sk','/workflow/test'])assert.equal((await fetch(origin+path,{headers})).status,404);
  assert.equal((await fetch(origin+'/api/internal/jumping-jax/ask')).status,401);assert.equal(calls.length,0);
  assert.equal((await fetch(origin+'/api/internal/jumping-jax/ask',{headers:{authorization:'Bearer '+token}})).status,403);
  assert.equal((await fetch(origin+'/api/internal/jumping-jax/published',{method:'POST',headers,body:'{}'})).status,405);
  const r=await fetch(origin+'/api/internal/jumping-jax/ask',{method:'POST',headers,body:JSON.stringify({action:'thread',id:'synthetic'})});assert.equal(r.status,200);assert.match(await r.text(),/Saved backend answer/);
  assert.equal(calls[0].url,'http://127.0.0.1:4330/api/internal/jumping-jax/ask');assert.equal(calls[0].options.headers['X-Jumping-Jax-Owner'],owner);assert.equal(calls[0].options.redirect,'error');
  assert.equal((await fetch(origin+'/api/internal/jumping-jax/ask',{method:'POST',headers,body:'x'.repeat(14001)})).status,413);
  body={error:token};const leak=await fetch(origin+'/api/internal/jumping-jax/ask',{headers});assert.equal(leak.status,502);assert.ok(!(await leak.text()).includes(token));
 }finally{await new Promise(r=>server.close(r));}
});

test('draft relay requires its own credential and admits one request at a time',async()=>{
 const draftToken='synthetic_'+ 'd'.repeat(48);
 let release,observed;
 const started=new Promise(resolve=>{observed=resolve;});
 const paused=new Promise(resolve=>{release=resolve;});
 const server=createGateway({token,draftToken,fetchImpl:async(url,options)=>{
  observed({url,options});
  await paused;
  return Response.json({executionId:'123'});
 }});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/webhook/jjx-social-draft-model-v1';
 const post=(target,bearer)=>fetch(target,{method:'POST',headers:{authorization:'Bearer '+bearer,'content-type':'application/json'},body:'{}'});
 try{
  assert.equal((await post(url,token)).status,401);
  assert.equal((await post(url+'?x=1',draftToken)).status,404);
  const first=post(url,draftToken);
  const request=await started;
  assert.equal(request.url,'http://127.0.0.1:5678/webhook/JjxSocialDraftV1/authenticated%2520draft%2520webhook/jjx-social-draft-model-v1');
  assert.equal(request.options.redirect,'error');
  assert.equal((await post(url,draftToken)).status,429);
  release();
  assert.deepEqual(await (await first).json(),{executionId:'123'});
 }finally{
  release();
  await new Promise(resolve=>server.close(resolve));
 }
});
