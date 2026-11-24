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
